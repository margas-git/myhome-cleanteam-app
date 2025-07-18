import { db } from "./server/db/connection.ts";
import { sql } from "drizzle-orm";

async function applyJobPriceMigration() {
  try {
    console.log("Applying job price and reference columns migration...");
    // Add price column to jobs table
    await db.execute(sql`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS price INTEGER`);
    // Add customer_name column to jobs table
    await db.execute(sql`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS customer_name VARCHAR(255)`);
    // Add staff column to time_entries table
    await db.execute(sql`ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS staff VARCHAR(255)`);
    console.log("✅ Added price, customer_name to jobs and staff to time_entries tables");
  } catch (error) {
    console.error("❌ Error applying migration:", error);
  }
  process.exit(0);
}

applyJobPriceMigration(); 