-- ① 本番環境にも正しい tenant_settings を作成（念のため）
CREATE TABLE IF NOT EXISTS tenant_settings (
    tenant_id TEXT PRIMARY KEY,
    warning_days INTEGER DEFAULT 30,
    updated_at TEXT DEFAULT (DATETIME('now', 'localtime'))
);

-- ② 初期データの挿入（テナントIDは暫定で 't-001' とします）
INSERT OR IGNORE INTO tenant_settings (tenant_id, warning_days) VALUES ('t-001', 30);

-- ③ 私が間違って提案した不要な settings テーブルを削除（クリーンアップ）
DROP TABLE IF EXISTS settings;