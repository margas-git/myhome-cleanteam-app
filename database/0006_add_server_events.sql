-- Add server_events table for cross-server event broadcasting
CREATE TABLE IF NOT EXISTS server_events (
  id SERIAL PRIMARY KEY,
  event_type TEXT NOT NULL,
  event_data JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  processed BOOLEAN DEFAULT FALSE,
  processed_at TIMESTAMP,
  server_id TEXT -- To avoid processing own events
);

-- Create index for efficient querying
CREATE INDEX IF NOT EXISTS idx_server_events_unprocessed ON server_events(processed, created_at) WHERE processed = FALSE;
CREATE INDEX IF NOT EXISTS idx_server_events_type ON server_events(event_type); 