import { Hono } from 'hono'
import type { AppEnv } from '../types'

const app = new Hono<AppEnv>()

// ==========================================
// 1. 設定API (/api/settings)
// ==========================================
app.get('/settings', async (c) => {
  const currentTenant = c.get('tenantId');
  try {
    const result: any = await c.env.DB.prepare(`SELECT tenant_name, warning_days FROM tenant_settings WHERE tenant_id = ?`).bind(currentTenant).first();
    return c.json({ tenantName: result?.tenant_name || '〇〇クリニック', warningDays: result?.warning_days ?? 30 });
  } catch (e: any) { return c.json({ error: e.message }, 500); }
});

app.post('/settings', async (c) => {
  const currentTenant = c.get('tenantId');
  try {
    const body = await c.req.json();
    await c.env.DB.prepare(`
      INSERT INTO tenant_settings (tenant_id, tenant_name, warning_days) VALUES (?, ?, ?)
      ON CONFLICT(tenant_id) DO UPDATE SET tenant_name = excluded.tenant_name, warning_days = excluded.warning_days, updated_at = DATETIME('now', 'localtime')
    `).bind(currentTenant, body.tenantName, body.warningDays).run();
    return c.json({ message: 'Settings saved' }, 200);
  } catch (e: any) { return c.json({ error: e.message }, 500); }
});

// ==========================================
// 2. マスタ API (/api/items)
// ==========================================
app.get('/items', async (c) => {
  const currentTenant = c.get('tenantId');
  try {
    // ★ location, unit, image_url を追加
    const { results } = await c.env.DB.prepare(`SELECT id, tenant_id, name, reorder_level, is_perishable, gtin_code, min_stock_threshold, location, unit, image_url FROM items WHERE tenant_id = ? ORDER BY name ASC`).bind(currentTenant).all();
    return c.json(results.map((r: any) => ({ 
      id: r.id, name: r.name, gtinCode: r.gtin_code, minStockThreshold: r.min_stock_threshold, 
      reorderLevel: r.reorder_level, isPerishable: Boolean(r.is_perishable),
      location: r.location, unit: r.unit, imageUrl: r.image_url // ★フロントエンド用にキャメルケースで返す
    })));
  } catch (e: any) { return c.json({ error: e.message }, 500); }
});

app.post('/items', async (c) => {
  const currentTenant = c.get('tenantId');
  const body = await c.req.json();
  const id = (globalThis as any).crypto.randomUUID();
  try {
    // ★ location, unit, image_url を保存
    await c.env.DB.prepare(
      `INSERT INTO items (id, tenant_id, name, reorder_level, is_perishable, gtin_code, min_stock_threshold, location, unit, image_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      id, currentTenant, body.name, body.reorderLevel || 0, body.isPerishable ? 1 : 0, 
      body.gtinCode || null, body.minStockThreshold || null,
      body.location || null, body.unit || '個', body.imageUrl || null
    ).run();
    return c.json({ id, message: 'Item created' }, 201);
  } catch (e: any) { return c.json({ error: e.message }, 500); }
});

app.put('/items/:id', async (c) => {
  const currentTenant = c.get('tenantId');
  const id = c.req.param('id');
  const body = await c.req.json();
  try {
    // ★ location, unit, image_url を更新
    await c.env.DB.prepare(`UPDATE items SET name = ?, gtin_code = ?, min_stock_threshold = ?, location = ?, unit = ?, image_url = ? WHERE id = ? AND tenant_id = ?`)
      .bind(
        body.name, body.gtinCode || null, body.minStockThreshold || null,
        body.location || null, body.unit || '個', body.imageUrl || null,
        id, currentTenant
      ).run();
    return c.json({ message: 'Item updated' }, 200);
  } catch (e: any) { return c.json({ error: e.message }, 500); }
});

app.post('/items/import', async (c) => {
  const currentTenant = c.get('tenantId');
  const rows = await c.req.json();
  const results = { inserted: 0, updated: 0, errors: [] as any[] };
  for (const row of rows) {
    try {
      const existing: any = await c.env.DB.prepare(`SELECT id FROM items WHERE name = ? AND tenant_id = ?`).bind(row.name, currentTenant).first();
      if (existing) {
        await c.env.DB.prepare(`UPDATE items SET gtin_code = ?, min_stock_threshold = ? WHERE id = ?`).bind(row.gtinCode || null, row.minStockThreshold || null, existing.id).run();
        results.updated++;
      } else {
        const newId = (globalThis as any).crypto.randomUUID();
        await c.env.DB.prepare(
          `INSERT INTO items (id, tenant_id, name, gtin_code, min_stock_threshold, reorder_level, is_perishable) VALUES (?, ?, ?, ?, ?, 0, 1)`
        ).bind(newId, currentTenant, row.name, row.gtinCode || null, row.minStockThreshold || null).run();
        results.inserted++;
      }
    } catch (e: any) { results.errors.push({ row, error: e.message }); }
  }
  return c.json({ message: 'Master import completed', results }, 200);
});

// ==========================================
// 3. スタッフ API (/api/staffs)
// ==========================================
app.get('/staffs', async (c) => {
  const currentTenant = c.get('tenantId');
  try {
    const { results } = await c.env.DB.prepare(`SELECT id, name, role FROM staffs WHERE is_active = 1 AND tenant_id = ? ORDER BY created_at ASC`).bind(currentTenant).all();
    return c.json(results);
  } catch (e: any) { return c.json({ error: e.message }, 500); }
});

app.post('/staffs', async (c) => {
  const currentTenant = c.get('tenantId');
  const body = await c.req.json();
  const id = (globalThis as any).crypto.randomUUID();
  try {
    await c.env.DB.prepare(`INSERT INTO staffs (id, name, role, tenant_id) VALUES (?, ?, ?, ?)`).bind(id, body.name, body.role || 'staff', currentTenant).run();
    return c.json({ id, message: 'Staff created' }, 201);
  } catch (e: any) { return c.json({ error: e.message }, 500); }
});

app.put('/staffs/:id', async (c) => {
  const currentTenant = c.get('tenantId');
  const id = c.req.param('id');
  const body = await c.req.json();
  try {
    await c.env.DB.prepare(`UPDATE staffs SET name = ?, role = ?, is_active = ? WHERE id = ? AND tenant_id = ?`).bind(body.name, body.role, body.isActive, id, currentTenant).run();
    return c.json({ message: 'Staff updated' }, 200);
  } catch (e: any) { return c.json({ error: e.message }, 500); }
});

export default app;