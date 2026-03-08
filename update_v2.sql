-- ==========================================
-- ① staffs（スタッフ）テーブルの新規作成
-- ==========================================
CREATE TABLE staffs (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    role TEXT DEFAULT 'staff', -- 'admin' または 'staff'
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (DATETIME('now', 'localtime'))
);

-- 共有端末の初期テスト用に、2名のスタッフを自動登録しておきます
INSERT INTO staffs (id, name, role) VALUES ('staff-001', '院長 (Admin)', 'admin');
INSERT INTO staffs (id, name, role) VALUES ('staff-002', 'テストスタッフ', 'staff');

-- ==========================================
-- ② items（商品マスタ）テーブルの拡張
-- ==========================================
-- バーコード対応のためのカラムを追加
ALTER TABLE items ADD COLUMN gtin_code TEXT;

-- 在庫下限アラートのためのカラムを追加（設定しない場合はNULL）
ALTER TABLE items ADD COLUMN min_stock_threshold INTEGER;

-- ==========================================
-- ③ stock_transactions（入出庫履歴）テーブルの改修
-- ==========================================
-- 1. 既存のテーブルの名前を一時的に変更する
ALTER TABLE stock_transactions RENAME TO old_stock_transactions;

-- 2. actorを廃止し、staff_idと外部キー制約を持たせた新しいテーブルを作成する
CREATE TABLE stock_transactions (
    id TEXT PRIMARY KEY,
    lot_id TEXT NOT NULL,
    type TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    staff_id TEXT NOT NULL, -- ここが actor から変わりました
    created_at TEXT DEFAULT (DATETIME('now', 'localtime')),
    FOREIGN KEY (lot_id) REFERENCES stock_lots(id),
    FOREIGN KEY (staff_id) REFERENCES staffs(id)
);

-- 3. 古いテーブルのデータを新しいテーブルへ移行する
-- （これまでの履歴はすべて、初期スタッフ 'staff-001' が行ったものとして紐付けます）
INSERT INTO stock_transactions (id, lot_id, type, quantity, staff_id, created_at)
SELECT id, lot_id, type, quantity, 'staff-001', created_at FROM old_stock_transactions;

-- 4. 移行が完了した古いテーブルを削除する
DROP TABLE old_stock_transactions;