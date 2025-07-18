-- Fix Daylight Savings Timestamps
-- Adjusts all timestamps between 06-10-2024 and 06-04-2025 by subtracting 1 hour
-- This corrects for the daylight savings issue

-- Update time_entries table
-- Adjust clock_in_time
UPDATE time_entries 
SET clock_in_time = clock_in_time - INTERVAL '1 hour'
WHERE clock_in_time >= '2024-10-06 00:00:00+00' 
  AND clock_in_time < '2025-04-06 23:59:59+00';

-- Adjust clock_out_time
UPDATE time_entries 
SET clock_out_time = clock_out_time - INTERVAL '1 hour'
WHERE clock_out_time >= '2024-10-06 00:00:00+00' 
  AND clock_out_time < '2025-04-06 23:59:59+00';

-- Update jobs table
-- Adjust created_at
UPDATE jobs 
SET created_at = created_at - INTERVAL '1 hour'
WHERE created_at >= '2024-10-06 00:00:00+00' 
  AND created_at < '2025-04-06 23:59:59+00';

-- Display summary of changes
SELECT 
    'time_entries clock_in_time' as table_field,
    COUNT(*) as records_updated
FROM time_entries 
WHERE clock_in_time >= '2024-10-06 00:00:00+00' 
  AND clock_in_time < '2025-04-06 23:59:59+00'
UNION ALL
SELECT 
    'time_entries clock_out_time' as table_field,
    COUNT(*) as records_updated
FROM time_entries 
WHERE clock_out_time >= '2024-10-06 00:00:00+00' 
  AND clock_out_time < '2025-04-06 23:59:59+00'
UNION ALL
SELECT 
    'jobs created_at' as table_field,
    COUNT(*) as records_updated
FROM jobs 
WHERE created_at >= '2024-10-06 00:00:00+00' 
  AND created_at < '2025-04-06 23:59:59+00'; 