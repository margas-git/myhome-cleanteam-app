-- Add price column to jobs table for job-specific pricing
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS price INTEGER; 