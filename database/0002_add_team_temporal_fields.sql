-- Add temporal fields to teams_users table
ALTER TABLE teams_users 
ADD COLUMN start_date DATE NOT NULL DEFAULT CURRENT_DATE,
ADD COLUMN end_date DATE;

-- Update existing records to have start_date as creation date
-- (This assumes existing records are currently active)
UPDATE teams_users 
SET start_date = CURRENT_DATE 
WHERE start_date IS NULL;

-- Add comment to explain the temporal nature
COMMENT ON COLUMN teams_users.start_date IS 'Date when user joined the team';
COMMENT ON COLUMN teams_users.end_date IS 'Date when user left the team (NULL = currently active)'; 