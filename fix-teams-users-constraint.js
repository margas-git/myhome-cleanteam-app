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

async function fixTeamsUsersConstraint() {
  try {
    console.log("=== Fixing Teams Users Unique Constraint ===\n");

    // Drop the existing unique constraint
    console.log("Dropping existing unique constraint...");
    await client`DROP INDEX IF EXISTS teams_users_pk_idx`;
    
    // Create new unique constraint that includes start_date
    console.log("Creating new unique constraint with start_date...");
    await client`CREATE UNIQUE INDEX teams_users_pk_idx ON teams_users (team_id, user_id, start_date)`;
    
    console.log("✅ Unique constraint updated successfully!");
    console.log("Now multiple periods per user-team combination are allowed.");
    
  } catch (error) {
    console.error("Error fixing constraint:", error);
  } finally {
    await client.end();
  }
}

fixTeamsUsersConstraint(); 