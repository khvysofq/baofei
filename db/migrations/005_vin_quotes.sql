-- 005_vin_quotes.sql — VIN 查询记录补充后端计算出的价格区间
-- 金额单位：分；整备质量缺失、报价待称重时保持 NULL。

ALTER TABLE vin_search_events
  ADD COLUMN IF NOT EXISTS quote_low_fen  integer,
  ADD COLUMN IF NOT EXISTS quote_mid_fen  integer,
  ADD COLUMN IF NOT EXISTS quote_high_fen integer,
  ADD COLUMN IF NOT EXISTS quote_net_fen  integer;