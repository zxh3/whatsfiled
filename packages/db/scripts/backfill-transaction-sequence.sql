-- Backfill per-filing transaction sequence for existing rows.
-- Run after adding transactions.sequence column.

BEGIN;

WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (PARTITION BY filing_id ORDER BY ctid ASC) AS seq
  FROM transactions
)
UPDATE transactions AS t
SET sequence = ranked.seq
FROM ranked
WHERE t.id = ranked.id
  AND t.sequence IS NULL;

ALTER TABLE transactions
ALTER COLUMN sequence SET NOT NULL;

COMMIT;
