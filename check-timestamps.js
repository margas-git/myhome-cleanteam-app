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

async function checkTimestamps() {
  try {
    console.log('🔍 Checking timestamps in database...\n');

    // Check time_entries
    console.log('📊 Time Entries Analysis:');
    
    const timeEntriesStats = await db
      .select({ 
        total: sql`COUNT(*)`,
        withClockIn: sql`COUNT(clock_in_time)`,
        withClockOut: sql`COUNT(clock_out_time)`,
        earliestClockIn: sql`MIN(clock_in_time)`,
        latestClockIn: sql`MAX(clock_in_time)`,
        earliestClockOut: sql`MIN(clock_out_time)`,
        latestClockOut: sql`MAX(clock_out_time)`
      })
      .from(sql`time_entries`);

    console.log(`- Total time entries: ${timeEntriesStats[0]?.total || 0}`);
    console.log(`- With clock in time: ${timeEntriesStats[0]?.withClockIn || 0}`);
    console.log(`- With clock out time: ${timeEntriesStats[0]?.withClockOut || 0}`);
    console.log(`- Earliest clock in: ${timeEntriesStats[0]?.earliestClockIn || 'N/A'}`);
    console.log(`- Latest clock in: ${timeEntriesStats[0]?.latestClockIn || 'N/A'}`);
    console.log(`- Earliest clock out: ${timeEntriesStats[0]?.earliestClockOut || 'N/A'}`);
    console.log(`- Latest clock out: ${timeEntriesStats[0]?.latestClockOut || 'N/A'}`);

    // Check jobs
    console.log('\n📊 Jobs Analysis:');
    
    const jobsStats = await db
      .select({ 
        total: sql`COUNT(*)`,
        earliestCreated: sql`MIN(created_at)`,
        latestCreated: sql`MAX(created_at)`
      })
      .from(sql`jobs`);

    console.log(`- Total jobs: ${jobsStats[0]?.total || 0}`);
    console.log(`- Earliest created: ${jobsStats[0]?.earliestCreated || 'N/A'}`);
    console.log(`- Latest created: ${jobsStats[0]?.latestCreated || 'N/A'}`);

    // Check specific date ranges
    console.log('\n📅 Date Range Analysis:');
    
    const targetRangeCount = await db
      .select({ 
        clockInInRange: sql`COUNT(*)`
      })
      .from(sql`time_entries`)
      .where(sql`clock_in_time >= '2024-10-06 00:00:00+00' AND clock_in_time < '2025-04-06 23:59:59+00'`);

    const jobsInRange = await db
      .select({ 
        jobsInRange: sql`COUNT(*)`
      })
      .from(sql`jobs`)
      .where(sql`created_at >= '2024-10-06 00:00:00+00' AND created_at < '2025-04-06 23:59:59+00'`);

    console.log(`- Time entries in target range (2024-10-06 to 2025-04-06): ${targetRangeCount[0]?.clockInInRange || 0}`);
    console.log(`- Jobs in target range (2024-10-06 to 2025-04-06): ${jobsInRange[0]?.jobsInRange || 0}`);

    // Show some sample records
    console.log('\n📋 Sample Records:');
    
    const sampleTimeEntries = await db
      .select({ 
        id: sql`id`,
        clock_in_time: sql`clock_in_time`,
        clock_out_time: sql`clock_out_time`
      })
      .from(sql`time_entries`)
      .where(sql`clock_in_time IS NOT NULL`)
      .orderBy(sql`clock_in_time DESC`)
      .limit(5);

    console.log('Sample time entries (most recent first):');
    sampleTimeEntries.forEach((entry, index) => {
      console.log(`  ${index + 1}. ID: ${entry.id}, Clock In: ${entry.clock_in_time}, Clock Out: ${entry.clock_out_time}`);
    });

    const sampleJobs = await db
      .select({ 
        id: sql`id`,
        created_at: sql`created_at`
      })
      .from(sql`jobs`)
      .orderBy(sql`created_at DESC`)
      .limit(5);

    console.log('\nSample jobs (most recent first):');
    sampleJobs.forEach((job, index) => {
      console.log(`  ${index + 1}. ID: ${job.id}, Created: ${job.created_at}`);
    });

  } catch (error) {
    console.error('❌ Error during timestamp check:', error);
    throw error;
  } finally {
    await client.end();
  }
}

// Run the check
checkTimestamps()
  .then(() => {
    console.log('\n✅ Timestamp check completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Check failed:', error);
    process.exit(1);
  }); 