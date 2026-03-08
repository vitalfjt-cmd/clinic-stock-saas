-- 1. 商品マスタ (items)
CREATE TABLE items (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    name TEXT NOT NULL,
    reorder_level REAL DEFAULT 0,
    is_perishable INTEGER DEFAULT 1, 
    created_at TEXT DEFAULT (DATETIME('now', 'localtime')),
    updated_at TEXT DEFAULT (DATETIME('now', 'localtime')), 
    gtin_code TEXT, 
    min_stock_threshold INTEGER, 
    location TEXT, 
    unit TEXT DEFAULT '個', 
    image_url TEXT)

CREATE INDEX idx_items_tenant ON items(tenant_id)

-- 2. 在庫ロット管理 (stock_lots)
CREATE TABLE stock_lots (
    id TEXT PRIMARY KEY,
    item_id TEXT NOT NULL,
    expiry_date TEXT, 
    quantity REAL DEFAULT 0,
    lot_number TEXT,
    created_at TEXT DEFAULT (DATETIME('now', 'localtime')),
    updated_at TEXT DEFAULT (DATETIME('now', 'localtime')), 
    tenant_id TEXT NOT NULL DEFAULT 't-001',

    FOREIGN KEY (item_id) REFERENCES items(id)
)

CREATE INDEX idx_lots_expiry ON stock_lots(expiry_date)

-- 3. 入出庫履歴 (stock_transactions)
CREATE TABLE stock_transactions (
    id TEXT PRIMARY KEY,
    lot_id TEXT NOT NULL,
    type TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    staff_id TEXT NOT NULL, 
    created_at TEXT DEFAULT (DATETIME('now', 'localtime')), 
    tenant_id TEXT NOT NULL DEFAULT 't-001',

    FOREIGN KEY (lot_id) REFERENCES stock_lots(id),
    FOREIGN KEY (staff_id) REFERENCES staffs(id)
)

-- 4. 警告表示前の日数 (tenant_settings)
CREATE TABLE tenant_settings (
    tenant_id TEXT PRIMARY KEY,
    warning_days INTEGER DEFAULT 30,
    updated_at TEXT DEFAULT (DATETIME('now', 'localtime')), 
    tenant_name TEXT DEFAULT '〇〇クリニック'
)

-- 5. スタッフマスタ (staffs)
CREATE TABLE staffs (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    role TEXT DEFAULT 'staff', 
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (DATETIME('now', 'localtime'))
, tenant_id TEXT NOT NULL DEFAULT 't-001')