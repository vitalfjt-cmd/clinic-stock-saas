-- テナント（クリニック）ごとの設定テーブル
CREATE TABLE tenant_settings (
    tenant_id TEXT PRIMARY KEY,
    warning_days INTEGER DEFAULT 30,
    updated_at TEXT DEFAULT (DATETIME('now', 'localtime'))
);

-- 初期データとして、現在のテナント（t-001）に「30日」を設定しておく
INSERT INTO tenant_settings (tenant_id, warning_days) VALUES ('t-001', 30);