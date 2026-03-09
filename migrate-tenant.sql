-- ① tenant_settings（システム設定）の引き継ぎ
UPDATE tenant_settings SET tenant_id = 'org_3AW2Ak2PPRN3rKTSGSiPhE8Gruu' WHERE tenant_id = 'YOUR_ORG_ID';

-- ② items（商品マスタ）の引き継ぎ
UPDATE items SET tenant_id = 'org_3AW2Ak2PPRN3rKTSGSiPhE8Gruu' WHERE tenant_id = 'YOUR_ORG_ID';

-- ③ stock_lots（在庫ロット）の引き継ぎ
UPDATE stock_lots SET tenant_id = 'org_3AW2Ak2PPRN3rKTSGSiPhE8Gruu' WHERE tenant_id = 'YOUR_ORG_ID';

-- ④ stock_transactions（入出庫履歴）の引き継ぎ
UPDATE stock_transactions SET tenant_id = 'org_3AW2Ak2PPRN3rKTSGSiPhE8Gruu' WHERE tenant_id = 'YOUR_ORG_ID';

-- ⑤ staffs（スタッフ）の引き継ぎ
UPDATE staffs SET tenant_id = 'org_3AW2Ak2PPRN3rKTSGSiPhE8Gruu' WHERE tenant_id = 'YOUR_ORG_ID';