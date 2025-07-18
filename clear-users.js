import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { config } from "dotenv";
import { resolve } from "path";

// Load environment variables
config({ path: resolve(".env") });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL environment variable is required");
}

const client = postgres(connectionString);
const db = drizzle(client);

async function clearTables() {
  try {
    console.log("=== Clearing Users, Time Entries, Team Memberships, and Jobs ===\n");

    // Show counts before deletion
    const userCount = await client`SELECT COUNT(*) as count FROM users`;
    const teamMemberships = await client`SELECT COUNT(*) as count FROM teams_users`;
    const timeEntries = await client`SELECT COUNT(*) as count FROM time_entries`;
    const jobsCount = await client`SELECT COUNT(*) as count FROM jobs`;

    console.log(`Before deletion:`);
    console.log(`  - Users: ${userCount[0].count}`);
    console.log(`  - Team Memberships: ${teamMemberships[0].count}`);
    console.log(`  - Time Entries: ${timeEntries[0].count}`);
    console.log(`  - Jobs: ${jobsCount[0].count}`);

    // Delete in order to avoid FK constraint issues
    await client`DELETE FROM time_entries`;
    await client`DELETE FROM teams_users`;
    await client`DELETE FROM jobs`;
    await client`DELETE FROM users`;

    // Show counts after deletion
    const userCountAfter = await client`SELECT COUNT(*) as count FROM users`;
    const teamMembershipsAfter = await client`SELECT COUNT(*) as count FROM teams_users`;
    const timeEntriesAfter = await client`SELECT COUNT(*) as count FROM time_entries`;
    const jobsCountAfter = await client`SELECT COUNT(*) as count FROM jobs`;

    console.log(`\nAfter deletion:`);
    console.log(`  - Users: ${userCountAfter[0].count}`);
    console.log(`  - Team Memberships: ${teamMembershipsAfter[0].count}`);
    console.log(`  - Time Entries: ${timeEntriesAfter[0].count}`);
    console.log(`  - Jobs: ${jobsCountAfter[0].count}`);

    console.log("\n✅ All specified tables have been cleared!");
  } catch (error) {
    console.error("Error clearing tables:", error);
  } finally {
    await client.end();
  }
}

clearTables(); 