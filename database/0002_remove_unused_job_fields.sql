-- Remove unused fields from jobs table
ALTER TABLE jobs DROP COLUMN IF EXISTS scheduled_date;
ALTER TABLE jobs DROP COLUMN IF EXISTS start_time;
ALTER TABLE jobs DROP COLUMN IF EXISTS end_time; 