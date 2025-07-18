import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { db } from "./server/db/connection.ts";
import { jobs } from "./server/db/schema.ts";

// Load .env from the root directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: resolve(__dirname, ".env") });

async function clearTeamFields() {
  try {
    console.log("🧹 Clearing team_members_at_creation and additional_staff fields...");
    
    // Update all jobs to set these fields to null
    await db
      .update(jobs)
      .set({
        teamMembersAtCreation: null,
        additionalStaff: null
      });
    
    console.log("✅ Cleared team_members_at_creation and additional_staff fields for all jobs.");
    
  } catch (error) {
    console.error("Error clearing team fields:", error);
  }
}

clearTeamFields(); 