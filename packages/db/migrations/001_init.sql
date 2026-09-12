-- SPEC §6 — RWAScreener v1 schema
-- quote_mints → configs → pools; launchpad_labels on fee_claimer;
-- ingest_cursor + ingest_jobs for backfill/webhook.

CREATE TABLE IF NOT EXISTS quote_mints (
  mint              text PRIMARY KEY,
  symbol            text NOT NULL,
  name              text,
  badge_verified_at timestamptz,
  meta              jsonb DEFAULT '{}',
  created_at        timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS configs (
  address       text PRIMARY KEY,
  quote_mint    text NOT NULL REFERENCES quote_mints(mint),
  fee_claimer   text,
  raw           jsonb,
  first_seen_at timestamptz NOT NULL,
  updated_at    timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pools (
  address       text PRIMARY KEY,
  config        text NOT NULL REFERENCES configs(address),
  base_mint     text NOT NULL,
  quote_mint    text NOT NULL REFERENCES quote_mints(mint),
  creator       text,
  activation_at timestamptz,
  created_at    timestamptz NOT NULL,
  status        text DEFAULT 'curve',
  raw           jsonb,
  indexed_at    timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS launchpad_labels (
  fee_claimer text PRIMARY KEY,
  label       text NOT NULL,
  website     text,
  notes       text,
  updated_at  timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ingest_cursor (
  name       text PRIMARY KEY,
  value      text NOT NULL,
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ingest_jobs (
  id           bigserial PRIMARY KEY,
  kind         text NOT NULL,
  payload      jsonb NOT NULL,
  status       text NOT NULL DEFAULT 'pending',
  attempts     int DEFAULT 0,
  available_at timestamptz DEFAULT now(),
  created_at   timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pools_created_at_desc_idx
  ON pools (created_at DESC);
CREATE INDEX IF NOT EXISTS pools_quote_mint_created_at_desc_idx
  ON pools (quote_mint, created_at DESC);
CREATE INDEX IF NOT EXISTS pools_config_idx
  ON pools (config);
CREATE INDEX IF NOT EXISTS configs_fee_claimer_idx
  ON configs (fee_claimer);
