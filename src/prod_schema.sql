CREATE TABLE IF NOT EXISTS items (
    id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, name TEXT NOT NULL, reorder_level INTEGER DEFAULT 0,
    is_perishable INTEGER DEFAULT 1, gtin_code TEXT, min_stock_threshold INTEGER, created_at TEXT DEFAULT (DATETIME('now', 'localtime'))
);

CREATE TABLE IF NOT EXISTS stock_lots (
    id TEXT PRIMARY KEY, item_id TEXT NOT NULL, expiry_date TEXT NOT NULL, quantity INTEGER NOT NULL,
    lot_number TEXT, created_at TEXT DEFAULT (DATETIME('now', 'localtime')), FOREIGN KEY (item_id) REFERENCES items(id)
);

CREATE TABLE IF NOT EXISTS staffs (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, role TEXT DEFAULT 'staff', is_active INTEGER DEFAULT 1, created_at TEXT DEFAULT (DATETIME('now', 'localtime'))
);

-- テスト用に2名だけ自動登録しておきます
INSERT INTO staffs (id, name, role) VALUES ('staff-001', '院長 (Admin)', 'admin');
INSERT INTO staffs (id, name, role) VALUES ('staff-002', 'テストスタッフ', 'staff');

CREATE TABLE IF NOT EXISTS stock_transactions (
    id TEXT PRIMARY KEY, lot_id TEXT NOT NULL, type TEXT NOT NULL, quantity INTEGER NOT NULL,
    staff_id TEXT NOT NULL, created_at TEXT DEFAULT (DATETIME('now', 'localtime')), FOREIGN KEY (lot_id) REFERENCES stock_lots(id), FOREIGN KEY (staff_id) REFERENCES staffs(id)
);