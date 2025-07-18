import { sql } from 'drizzle-orm';
import { db } from './server/db/connection.ts';
import fs from 'fs';

async function runMigration() {
  try {
    console.log('Running invoice migration...');
    
    const migrationSQL = fs.readFileSync('./database/0004_add_invoicing_only.sql', 'utf8');
    
    // Split the SQL into individual statements
    const statements = migrationSQL.split('--> statement-breakpoint').map(stmt => stmt.trim()).filter(stmt => stmt.length > 0);
    
    for (const statement of statements) {
      console.log('Executing:', statement.substring(0, 50) + '...');
      await db.execute(sql.raw(statement));
    }
    
    console.log('Migration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    process.exit(0);
  }
}

runMigration(); 