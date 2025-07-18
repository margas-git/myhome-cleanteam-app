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

async function resetSequences() {
  try {
    console.log("=== Resetting ID Sequences for users, teams, jobs ===\n");
    await client`ALTER SEQUENCE users_id_seq RESTART WITH 1`;
    await client`ALTER SEQUENCE teams_id_seq RESTART WITH 1`;
    await client`ALTER SEQUENCE jobs_id_seq RESTART WITH 1`;
    console.log("✅ Sequences reset. Next insert will use ID 1 (if table is empty).");
  } catch (error) {
    console.error("Error resetting sequences:", error);
  } finally {
    await client.end();
  }
}

resetSequences(); 