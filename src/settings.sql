-- 設定保存用のテーブルを作成
CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY,
    warning_days INTEGER NOT NULL DEFAULT 30
);

-- 初期値として「30日」を登録しておく
INSERT OR IGNORE INTO settings (id, warning_days) VALUES (1, 30);