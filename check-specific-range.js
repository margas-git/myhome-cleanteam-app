import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { sql } from 'drizzle-orm';

// Load .env from the root directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: resolve(__dirname, ".env") });

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("DATABASE_URL environment variable is required");
  process.exit(1);
}

const client = postgres(connectionString);
const db = drizzle(client);

async function checkSpecificRange() {
  try {
    console.log('🔍 Checking specific date range: 2024-10-06 to 2025-04-06\n');

    // Check time entries in the specific range
    const timeEntriesInRange = await db
      .select({ 
        id: sql`id`,
        clock_in_time: sql`clock_in_time`,
        clock_out_time: sql`clock_out_time`,
        user_id: sql`user_id`,
        job_id: sql`job_id`
      })
      .from(sql`time_entries`)
      .where(sql`clock_in_time >= '2024-10-06 00:00:00+00' AND clock_in_time < '2025-04-06 23:59:59+00'`)
      .orderBy(sql`clock_in_time ASC`)
      .limit(10);

    console.log(`📊 Found ${timeEntriesInRange.length} time entries in range (showing first 10):`);
    timeEntriesInRange.forEach((entry, index) => {
      console.log(`  ${index + 1}. ID: ${entry.id}, User: ${entry.user_id}, Job: ${entry.job_id}`);
      console.log(`     Clock In: ${entry.clock_in_time}`);
      console.log(`     Clock Out: ${entry.clock_out_time}`);
      console.log('');
    });

    // Check jobs in the specific range
    const jobsInRange = await db
      .select({ 
        id: sql`id`,
        created_at: sql`created_at`,
        customer_id: sql`customer_id`,
        team_id: sql`team_id`
      })
      .from(sql`jobs`)
      .where(sql`created_at >= '2024-10-06 00:00:00+00' AND created_at < '2025-04-06 23:59:59+00'`)
      .orderBy(sql`created_at ASC`)
      .limit(10);

    console.log(`📊 Found ${jobsInRange.length} jobs in range (showing first 10):`);
    jobsInRange.forEach((job, index) => {
      console.log(`  ${index + 1}. ID: ${job.id}, Customer: ${job.customer_id}, Team: ${job.team_id}`);
      console.log(`     Created: ${job.created_at}`);
      console.log('');
    });

    // Check if there are any records that might need adjustment
    console.log('🔍 Checking for potential daylight savings issues...');
    
    // Look for records around the daylight savings transition dates
    const daylightSavingsCheck = await db
      .select({ 
        id: sql`id`,
        clock_in_time: sql`clock_in_time`,
        clock_out_time: sql`clock_out_time`
      })
      .from(sql`time_entries`)
      .where(sql`clock_in_time >= '2024-10-05 00:00:00+00' AND clock_in_time <= '2024-10-07 23:59:59+00'`)
      .orderBy(sql`clock_in_time ASC`);

    console.log(`📅 Records around October 6, 2024 (daylight savings start): ${daylightSavingsCheck.length}`);
    if (daylightSavingsCheck.length > 0) {
      console.log('Sample records around this date:');
      daylightSavingsCheck.slice(0, 5).forEach((entry, index) => {
        console.log(`  ${index + 1}. ID: ${entry.id}, Clock In: ${entry.clock_in_time}, Clock Out: ${entry.clock_out_time}`);
      });
    }

  } catch (error) {
    console.error('❌ Error during specific range check:', error);
    throw error;
  } finally {
    await client.end();
  }
}

// Run the check
checkSpecificRange()
  .then(() => {
    console.log('\n✅ Specific range check completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Check failed:', error);
    process.exit(1);
  }); 