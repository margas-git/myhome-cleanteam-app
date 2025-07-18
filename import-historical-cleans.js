import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import XLSX from "xlsx";
import { db } from "./server/db/connection.ts";
import { jobs, timeEntries, customers, users } from "./server/db/schema.ts";
import { eq } from "drizzle-orm";

// Load .env from the root directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: resolve(__dirname, ".env") });

async function importHistoricalCleans() {
  try {
    console.log("📊 Importing historical cleans...");

    // Read the Excel file
    const workbook = XLSX.readFile("historical-cleans-template-correct.xlsx");
    
    if (!workbook.Sheets["jobs"]) {
      console.error("❌ 'jobs' sheet not found in historical-cleans.xlsx");
      return;
    }

    if (!workbook.Sheets["time_entries"]) {
      console.error("❌ 'time_entries' sheet not found in historical-cleans.xlsx");
      return;
    }

    const jobsData = XLSX.utils.sheet_to_json(workbook.Sheets["jobs"]);
    const timeEntriesData = XLSX.utils.sheet_to_json(workbook.Sheets["time_entries"]);

    console.log(`📋 Found ${jobsData.length} jobs and ${timeEntriesData.length} time entries`);

    if (jobsData.length === 0) {
      console.log("❌ No jobs found in the Excel file");
      return;
    }

    let importedJobs = 0;
    let importedTimeEntries = 0;
    let errors = 0;

    // Import jobs first
    for (const job of jobsData) {
      try {
        // Handle both ID and name-based inputs
        let customerId = null;
        let teamId = null;

        // Get customer ID - try direct ID first, then lookup by name
        if (job.customer_id && !isNaN(job.customer_id)) {
          customerId = parseInt(job.customer_id);
        } else if (job.customer_name) {
          const customer = await db
            .select({ id: customers.id })
            .from(customers)
            .where(eq(customers.name, job.customer_name))
            .limit(1);
          
          if (customer.length > 0) {
            customerId = customer[0].id;
          } else {
            console.log(`⚠️  Customer not found: ${job.customer_name}`);
            errors++;
            continue;
          }
        } else {
          console.log(`⚠️  Skipping job - missing customer information:`, job);
          errors++;
          continue;
        }

        // Get team ID - try direct ID first, then lookup by name
        if (job.team_id && !isNaN(job.team_id)) {
          teamId = parseInt(job.team_id);
        } else if (job.team_name) {
          // For now, use team ID 1 for "Cleaning Team A" and 2 for "Cleaning Team B"
          if (job.team_name.toLowerCase().includes("team a")) {
            teamId = 1;
          } else if (job.team_name.toLowerCase().includes("team b")) {
            teamId = 2;
          } else {
            teamId = 1; // Default to team A
          }
        }

        // Validate required fields
        if (!job.scheduled_date || !job.status) {
          console.log(`⚠️  Skipping job - missing required fields:`, job);
          errors++;
          continue;
        }

        // Parse dates and times
        const scheduledDate = new Date(job.scheduled_date);
        const startTime = job.start_time ? job.start_time : null;
        const endTime = job.end_time ? job.end_time : null;

        // Insert job
        const [insertedJob] = await db.insert(jobs).values({
          customerId: customerId,
          teamId: teamId,
          scheduledDate: scheduledDate,
          startTime: startTime,
          endTime: endTime,
          status: job.status,
          createdAt: new Date()
        }).returning();

        console.log(`✅ Imported job for customer ID ${customerId} on ${job.scheduled_date}`);
        importedJobs++;

        // Find corresponding time entries for this job
        const jobTimeEntries = timeEntriesData.filter(entry => {
          // Match by customer name and job date
          const entryCustomerName = entry.customer_name || entry.customer_id;
          const jobCustomerName = job.customer_name || job.customer_id;
          const entryDate = entry.job_date || entry.scheduled_date;
          const jobDate = job.scheduled_date;
          
          return (entryCustomerName === jobCustomerName && entryDate === jobDate);
        });

        // Import time entries for this job
        for (const entry of jobTimeEntries) {
          try {
            // Get user ID - try direct ID first, then lookup by name
            let userId = null;
            
            if (entry.user_id && !isNaN(entry.user_id)) {
              userId = parseInt(entry.user_id);
            } else if (entry.user_name || entry.username) {
              const userName = entry.user_name || entry.username;
              const user = await db
                .select({ id: users.id })
                .from(users)
                .where(eq(users.firstName + " " + users.lastName, userName))
                .limit(1);
              
              if (user.length > 0) {
                userId = user[0].id;
              } else {
                console.log(`⚠️  User not found: ${userName}`);
                errors++;
                continue;
              }
            } else {
              console.log(`⚠️  Skipping time entry - missing user information:`, entry);
              errors++;
              continue;
            }

            // Validate required fields
            if (!entry.clock_in_time || !entry.clock_out_time) {
              console.log(`⚠️  Skipping time entry - missing required fields:`, entry);
              errors++;
              continue;
            }

            // Parse timestamps
            const clockInTime = new Date(entry.clock_in_time);
            const clockOutTime = new Date(entry.clock_out_time);

            // Insert time entry (no team validation for historical data)
            await db.insert(timeEntries).values({
              userId: userId,
              jobId: insertedJob.id,
              clockInTime: clockInTime,
              clockOutTime: clockOutTime,
              lunchBreak: entry.lunch_break === true || entry.lunch_break === "true",
              geofenceOverride: entry.geofence_override === true || entry.geofence_override === "true",
              autoLunchDeducted: entry.auto_lunch_deducted === true || entry.auto_lunch_deducted === "true"
            });

            console.log(`  ✅ Imported time entry for user ID ${userId}`);
            importedTimeEntries++;

          } catch (error) {
            console.error(`❌ Error importing time entry:`, error);
            errors++;
          }
        }

      } catch (error) {
        console.error(`❌ Error importing job:`, error);
        errors++;
      }
    }

    console.log(`\n📈 Import Summary:`);
    console.log(`✅ Successfully imported: ${importedJobs} jobs`);
    console.log(`✅ Successfully imported: ${importedTimeEntries} time entries`);
    console.log(`❌ Errors: ${errors}`);

  } catch (error) {
    console.error("❌ Error during import:", error);
  }
}

// Run the import
importHistoricalCleans(); 