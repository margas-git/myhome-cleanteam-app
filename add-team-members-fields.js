import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { db, client } from "./server/db/connection.ts";
import { jobs, timeEntries, users, teamsUsers } from "./server/db/schema.ts";
import { eq, and, sql, isNull, gte, lte, or } from "drizzle-orm";

// Load .env from the root directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: resolve(__dirname, ".env") });

async function addTeamMembersFields() {
  try {
    console.log("🔧 Adding team_members_at_creation and additional_staff fields to jobs table...");
    
    // Add the new fields to the jobs table
    await client`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS team_members_at_creation JSONB`;
    await client`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS additional_staff JSONB`;
    
    console.log("✅ Added team_members_at_creation and additional_staff fields to jobs table.");
    
    // Get all jobs with their creation dates and team IDs
    const allJobs = await db
      .select({
        id: jobs.id,
        teamId: jobs.teamId,
        createdAt: jobs.createdAt
      })
      .from(jobs)
      .orderBy(jobs.id);
    
    console.log(`📊 Processing ${allJobs.length} jobs...`);
    
    let successCount = 0;
    let errorCount = 0;
    
    for (const job of allJobs) {
      try {
        if (!job.teamId || !job.createdAt) {
          console.log(`⚠️ Job ${job.id}: Missing teamId or createdAt, skipping...`);
          continue;
        }
        
        const jobCreationDate = new Date(job.createdAt);
        
        // 1. Get team members who were in the team at job creation time
        const teamMembersAtCreation = await db
          .select({
            userId: teamsUsers.userId,
            firstName: users.firstName,
            lastName: users.lastName
          })
          .from(teamsUsers)
          .innerJoin(users, eq(teamsUsers.userId, users.id))
          .where(
            and(
              eq(teamsUsers.teamId, job.teamId),
              lte(teamsUsers.startDate, jobCreationDate),
              or(
                isNull(teamsUsers.endDate),
                gte(teamsUsers.endDate, jobCreationDate)
              )
            )
          );
        
        // 2. Get all people who worked on this job
        const allWorkers = await db
          .select({
            userId: timeEntries.userId,
            firstName: users.firstName,
            lastName: users.lastName
          })
          .from(timeEntries)
          .innerJoin(users, eq(timeEntries.userId, users.id))
          .where(eq(timeEntries.jobId, job.id))
          .groupBy(timeEntries.userId, users.firstName, users.lastName);
        
        // 3. Create sets for easy comparison
        const coreTeamUserIds = new Set(teamMembersAtCreation.map(m => m.userId));
        const allWorkerUserIds = new Set(allWorkers.map(w => w.userId));
        
        // 4. Determine additional staff (people who worked but weren't in core team)
        const additionalStaffUserIds = new Set();
        for (const worker of allWorkers) {
          if (!coreTeamUserIds.has(worker.userId)) {
            additionalStaffUserIds.add(worker.userId);
          }
        }
        
        // 5. Prepare data for database
        const teamMembersAtCreationNames = teamMembersAtCreation.map(m => `${m.firstName} ${m.lastName}`);
        const additionalStaffNames = allWorkers
          .filter(w => additionalStaffUserIds.has(w.userId))
          .map(w => `${w.firstName} ${w.lastName}`);
        
        // 6. Update the job with the correct data
        await db
          .update(jobs)
          .set({
            teamMembersAtCreation: teamMembersAtCreationNames,
            additionalStaff: additionalStaffNames
          })
          .where(eq(jobs.id, job.id));
        
        successCount++;
        
        // Log example for verification
        if (successCount <= 3) {
          console.log(`\n📋 Job ${job.id} (Team ${job.teamId}):`);
          console.log(`  Core team members: ${teamMembersAtCreationNames.join(', ') || 'None'}`);
          console.log(`  Additional staff: ${additionalStaffNames.join(', ') || 'None'}`);
        }
        
      } catch (error) {
        console.error(`❌ Error processing job ${job.id}:`, error);
        errorCount++;
      }
    }
    
    console.log(`\n✅ Successfully processed: ${successCount} jobs`);
    console.log(`❌ Errors: ${errorCount} jobs`);
    
  } catch (error) {
    console.error("Error adding team members fields:", error);
  }
}

addTeamMembersFields(); 