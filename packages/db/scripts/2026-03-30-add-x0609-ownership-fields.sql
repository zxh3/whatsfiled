ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS foreign_trading_symbol varchar(14);

ALTER TABLE insiders
  ADD COLUMN IF NOT EXISTS street_1 varchar(40),
  ADD COLUMN IF NOT EXISTS street_2 varchar(40),
  ADD COLUMN IF NOT EXISTS city varchar(30),
  ADD COLUMN IF NOT EXISTS state varchar(2),
  ADD COLUMN IF NOT EXISTS zip_code varchar(10),
  ADD COLUMN IF NOT EXISTS state_description varchar(100),
  ADD COLUMN IF NOT EXISTS non_us_address_flag boolean,
  ADD COLUMN IF NOT EXISTS non_us_state_territory varchar(40),
  ADD COLUMN IF NOT EXISTS country varchar(2);
