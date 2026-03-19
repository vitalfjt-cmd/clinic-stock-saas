import { Hono } from 'hono'
import type { AppEnv } from '../types'

const app = new Hono<AppEnv>()

// ==========================================
// 4. 在庫ロット API (/api/lots)
// ==========================================
app.get('/lots', async (c) => {
  const currentTenant = c.get('tenantId');
  try {
    const { results } = await c.env.DB.prepare(`
      SELECT l.id, l.item_id, i.name as itemName, l.expiry_date, l.quantity, l.lot_number
      FROM stock_lots l JOIN items i ON l.item_id = i.id
      WHERE l.tenant_id = ? ORDER BY l.expiry_date ASC
    `).bind(currentTenant).all();
    return c.json(results.map((r: any) => ({ id: r.id, itemId: r.item_id, itemName: r.itemName, expiryDate: r.expiry_date, quantity: r.quantity, lotNumber: r.lot_number })));
  } catch (e: any) { return c.json({ error: e.message }, 500); }
});

app.post('/lots', async (c) => {
  const currentTenant = c.get('tenantId');
  const body = await c.req.json();
  const id = (globalThis as any).crypto.randomUUID();
  const txId = (globalThis as any).crypto.randomUUID();
  try {
    const existing: any = await c.env.DB.prepare(`SELECT id, quantity FROM stock_lots WHERE item_id = ? AND expiry_date = ? AND IFNULL(lot_number, '') = ? AND tenant_id = ?`)
      .bind(body.itemId, body.expiryDate, body.lotNumber || '', currentTenant).first();
    if (existing) {
      await c.env.DB.batch([
        c.env.DB.prepare(`UPDATE stock_lots SET quantity = quantity + ? WHERE id = ?`).bind(body.quantity, existing.id),
        c.env.DB.prepare(`INSERT INTO stock_transactions (id, lot_id, type, quantity, staff_id, tenant_id) VALUES (?, ?, 'IN', ?, ?, ?)`).bind(txId, existing.id, body.quantity, body.staffId || 'staff-001', currentTenant)
      ]);
    } else {
      await c.env.DB.batch([
        c.env.DB.prepare(`INSERT INTO stock_lots (id, item_id, expiry_date, quantity, lot_number, tenant_id) VALUES (?, ?, ?, ?, ?, ?)`).bind(id, body.itemId, body.expiryDate, body.quantity, body.lotNumber || null, currentTenant),
        c.env.DB.prepare(`INSERT INTO stock_transactions (id, lot_id, type, quantity, staff_id, tenant_id) VALUES (?, ?, 'IN', ?, ?, ?)`).bind(txId, id, body.quantity, body.staffId || 'staff-001', currentTenant)
      ]);
    }
    return c.json({ message: 'Lot added' }, 201);
  } catch (e: any) { return c.json({ error: e.message }, 500); }
});

app.put('/lots/:id', async (c) => {
  const currentTenant = c.get('tenantId');
  const id = c.req.param('id');
  const body = await c.req.json();
  try {
    // ★ expiry_date も同時に更新するようにSQLとbindを追加
    await c.env.DB.prepare(`UPDATE stock_lots SET expiry_date = ?, lot_number = ? WHERE id = ? AND tenant_id = ?`)
      .bind(body.expiryDate, body.lotNumber || null, id, currentTenant).run();
    return c.json({ message: 'Lot updated' }, 200);
  } catch (e: any) { return c.json({ error: e.message }, 500); }
});

app.delete('/lots/:id', async (c) => {
  const currentTenant = c.get('tenantId');
  const lotId = c.req.param('id');
  try {
    await c.env.DB.batch([
      c.env.DB.prepare(`DELETE FROM stock_transactions WHERE lot_id = ? AND tenant_id = ?`).bind(lotId, currentTenant),
      c.env.DB.prepare(`DELETE FROM stock_lots WHERE id = ? AND tenant_id = ?`).bind(lotId, currentTenant)
    ]);
    return c.json({ message: 'Deleted' }, 200);
  } catch (e: any) { return c.json({ error: e.message }, 500); }
});

// ==========================================
// 5. 履歴・トランザクション API (/api/transactions)
// ==========================================
app.get('/transactions', async (c) => {
  const currentTenant = c.get('tenantId');
  try {
    const { results } = await c.env.DB.prepare(`
      SELECT t.id, t.type, t.quantity, s.name as actor, t.created_at, l.lot_number, i.name as itemName
      FROM stock_transactions t
      LEFT JOIN staffs s ON t.staff_id = s.id
      LEFT JOIN stock_lots l ON t.lot_id = l.id
      LEFT JOIN items i ON l.item_id = i.id
      WHERE t.tenant_id = ? ORDER BY t.created_at DESC LIMIT 100
    `).bind(currentTenant).all();
    return c.json(results.map((r: any) => ({ id: r.id, type: r.type, quantity: r.quantity, createdAt: r.created_at, actor: r.actor || '不明', itemName: r.itemName || '不明', lotNumber: r.lot_number })));
  } catch (e: any) { return c.json({ error: e.message }, 500); }
});

app.post('/transactions', async (c) => {
  const currentTenant = c.get('tenantId');
  const body = await c.req.json();
  const txId = (globalThis as any).crypto.randomUUID();
  try {
    await c.env.DB.batch([
      c.env.DB.prepare(`UPDATE stock_lots SET quantity = quantity + ? WHERE id = ? AND tenant_id = ?`).bind(body.quantity, body.lotId, currentTenant),
      c.env.DB.prepare(`INSERT INTO stock_transactions (id, lot_id, type, quantity, staff_id, tenant_id) VALUES (?, ?, ?, ?, ?, ?)`).bind(txId, body.lotId, body.type, body.quantity, body.staffId || 'staff-001', currentTenant)
    ]);
    return c.json({ message: 'Transaction recorded' }, 201);
  } catch (e: any) { return c.json({ error: e.message }, 500); }
});

// ==========================================
// 6. CSVインポート & 棚卸しAPI (/api/import, /api/inventory-check)
// ==========================================
app.post('/import', async (c) => {
  const currentTenant = c.get('tenantId');
  const rows = await c.req.json();
  const results = { inserted: 0, updated: 0, errors: [] as any[] };
  for (const row of rows) {
    try {
      let item: any = await c.env.DB.prepare(`SELECT id FROM items WHERE name = ? AND tenant_id = ?`).bind(row.itemName, currentTenant).first();
      if (!item) {
        const newItemId = (globalThis as any).crypto.randomUUID();
        await c.env.DB.prepare(`INSERT INTO items (id, tenant_id, name, reorder_level, is_perishable) VALUES (?, ?, ?, 0, 1)`).bind(newItemId, currentTenant, row.itemName).run();
        item = { id: newItemId };
      }
      const existingLot: any = await c.env.DB.prepare(`SELECT id FROM stock_lots WHERE item_id = ? AND expiry_date = ? AND IFNULL(lot_number, '') = ? AND tenant_id = ?`).bind(item.id, row.expiryDate, row.lotNumber || '', currentTenant).first();
      const txId = (globalThis as any).crypto.randomUUID();
      if (existingLot) {
        await c.env.DB.batch([
          c.env.DB.prepare(`UPDATE stock_lots SET quantity = quantity + ? WHERE id = ?`).bind(row.quantity, existingLot.id),
          c.env.DB.prepare(`INSERT INTO stock_transactions (id, lot_id, type, quantity, staff_id, tenant_id) VALUES (?, ?, 'IN', ?, ?, ?)`).bind(txId, existingLot.id, row.quantity, row.staffId || 'staff-001', currentTenant)
        ]);
        results.updated++;
      } else {
        const newLotId = (globalThis as any).crypto.randomUUID();
        await c.env.DB.batch([
          c.env.DB.prepare(`INSERT INTO stock_lots (id, item_id, expiry_date, quantity, lot_number, tenant_id) VALUES (?, ?, ?, ?, ?, ?)`).bind(newLotId, item.id, row.expiryDate, row.quantity, row.lotNumber || null, currentTenant),
          c.env.DB.prepare(`INSERT INTO stock_transactions (id, lot_id, type, quantity, staff_id, tenant_id) VALUES (?, ?, 'IN', ?, ?, ?)`).bind(txId, newLotId, row.quantity, row.staffId || 'staff-001', currentTenant)
        ]);
        results.inserted++;
      }
    } catch (e: any) { results.errors.push({ row, error: e.message }); }
  }
  return c.json({ message: 'Import completed', results }, 200);
});

app.post('/inventory-check', async (c) => {
  const currentTenant = c.get('tenantId');
  const body = await c.req.json();
  try {
    const statements = [];
    let updatedCount = 0;
    for (const item of body.items) {
      const currentLot: any = await c.env.DB.prepare(`SELECT quantity FROM stock_lots WHERE id = ? AND tenant_id = ?`).bind(item.lotId, currentTenant).first();
      if (currentLot && currentLot.quantity !== item.actualQuantity) {
        const diff = item.actualQuantity - currentLot.quantity;
        const txId = (globalThis as any).crypto.randomUUID();
        statements.push(
          c.env.DB.prepare(`UPDATE stock_lots SET quantity = ? WHERE id = ?`).bind(item.actualQuantity, item.lotId),
          c.env.DB.prepare(`INSERT INTO stock_transactions (id, lot_id, type, quantity, staff_id, tenant_id) VALUES (?, ?, 'INVENTORY', ?, ?, ?)`).bind(txId, item.lotId, diff, body.staffId, currentTenant)
        );
        updatedCount++;
      }
    }
    if (statements.length > 0) await c.env.DB.batch(statements);
    return c.json({ message: 'Inventory checked', updatedCount }, 200);
  } catch (e: any) { return c.json({ error: e.message }, 500); }
});

export default app;