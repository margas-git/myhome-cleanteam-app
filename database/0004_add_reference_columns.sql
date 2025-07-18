-- Add customer_name to jobs table
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS customer_name VARCHAR(255);

-- Add staff to time_entries table
ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS staff VARCHAR(255); 