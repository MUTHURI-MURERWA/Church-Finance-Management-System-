ALTER TABLE members
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'active';

ALTER TABLE members
  ADD COLUMN IF NOT EXISTS last_contribution_date DATE;

ALTER TABLE members
  ADD COLUMN IF NOT EXISTS manually_set_status BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE members
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

UPDATE members m
SET last_contribution_date = sub.last_date
FROM (
  SELECT member_id, MAX(transaction_date) AS last_date
  FROM transactions
  WHERE transaction_type != 'Expense'
  GROUP BY member_id
) sub
WHERE m.id = sub.member_id;

UPDATE members
SET status = 'dormant'
WHERE manually_set_status = FALSE
  AND (
    last_contribution_date IS NULL
    OR last_contribution_date < NOW() - INTERVAL '6 months'
  );