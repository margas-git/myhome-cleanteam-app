import { Client } from 'pg';

// This script adds the createdByUserId field to the customers table
// Run this with: node apply-customer-created-by-migration.js

async function applyMigration() {
  // You'll need to set your DATABASE_URL environment variable
  const databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    console.error('DATABASE_URL environment variable is required');
    console.error('Example: DATABASE_URL=postgresql://user:password@host:port/database node apply-customer-created-by-migration.js');
    process.exit(1);
  }

  const client = new Client({
    connectionString: databaseUrl,
    ssl: databaseUrl.includes('neon.tech') ? { rejectUnauthorized: false } : false
  });

  try {
    await client.connect();
    console.log('Connected to database');

    // Check if the column already exists
    const checkColumnQuery = `
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'customers' AND column_name = 'created_by_user_id'
    `;
    
    const checkResult = await client.query(checkColumnQuery);
    
    if (checkResult.rows.length > 0) {
      console.log('Column created_by_user_id already exists');
      return;
    }

    // Add the column
    console.log('Adding created_by_user_id column to customers table...');
    await client.query(`
      ALTER TABLE customers ADD COLUMN created_by_user_id INTEGER REFERENCES users(id)
    `);

    // Add index for better performance
    console.log('Adding index for created_by_user_id...');
    await client.query(`
      CREATE INDEX idx_customers_created_by_user_id ON customers(created_by_user_id)
    `);

    console.log('Migration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

applyMigration(); 