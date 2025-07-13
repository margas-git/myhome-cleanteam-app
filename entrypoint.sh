#!/bin/sh

# Wait for the database to be ready (simple approach)
echo "Waiting for database to be ready..."
sleep 10

# Run migrations and seed
echo "Running database setup..."
npm run db:setup || true

# Start the app
echo "Starting application..."
npm start 