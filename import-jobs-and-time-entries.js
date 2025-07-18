import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import XLSX from "xlsx";
import { db } from "./server/db/connection.ts";
import { jobs, timeEntries, customers, users, invoiceItems, invoices } from "./server/db/schema.ts";
import { eq } from "drizzle-orm";
import { client } from "./server/db/connection.ts";

// Load .env from the root directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: resolve(__dirname, ".env") });

async function importJobsAndTimeEntries() {
  try {
    // Clear invoice_items and invoices before jobs and time_entries
    console.log("\u26a0\ufe0f Clearing invoice_items and invoices tables before jobs and time_entries...");
    await db.delete(invoiceItems);
    await db.delete(invoices);
    console.log("\u2705 Cleared invoice_items and invoices tables.");

    // Clear time_entries and jobs tables before import
    console.log("\u26a0\ufe0f Clearing time_entries and jobs tables before import...");
    await db.delete(timeEntries);
    await db.delete(jobs);
    console.log("\u2705 Cleared time_entries and jobs tables.");

    // Reset primary key sequences for all four tables
    console.log("\u26a0\ufe0f Resetting primary key sequences for invoice_items, invoices, jobs, and time_entries...");
    await client`ALTER SEQUENCE invoice_items_id_seq RESTART WITH 1`;
    await client`ALTER SEQUENCE invoices_id_seq RESTART WITH 1`;
    await client`ALTER SEQUENCE jobs_id_seq RESTART WITH 1`;
    await client`ALTER SEQUENCE time_entries_id_seq RESTART WITH 1`;
    console.log("\u2705 Reset all primary key sequences to 1.");

    console.log("📊 Importing jobs and time entries from MyHome_Data.xlsx...");

    // Read the Excel file
    const workbook = XLSX.readFile("team-changes/MyHome_Data.xlsx");
    
    if (!workbook.Sheets["jobs"]) {
      console.error("❌ 'jobs' sheet not found in MyHome_Data.xlsx");
      return;
    }

    if (!workbook.Sheets["time_entries"]) {
      console.error("❌ 'time_entries' sheet not found in MyHome_Data.xlsx");
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

    // Map Excel job_id to actual DB job ID
    const jobIdMap = {};

    // Import jobs first
    for (const job of jobsData) {
      try {
        // Handle both ID and name-based inputs
        let customerId = null;

        // Get customer ID - try direct ID first, then lookup by name
        if (job.customer_id && !isNaN(job.customer_id)) {
          customerId = parseInt(job.customer_id);
        } else if (job.customer_name) {
          const customer = await db
            .select({ id: customers.id, price: customers.price })
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
        let teamId = null;
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

        // Get customer's default price if job price is not specified
        let jobPrice = null;
        if (job.price && !isNaN(job.price)) {
          jobPrice = parseInt(job.price);
        } else {
          // Get customer's default price
          const customer = await db
            .select({ price: customers.price })
            .from(customers)
            .where(eq(customers.id, customerId))
            .limit(1);
          
          if (customer.length > 0) {
            jobPrice = customer[0].price;
          }
        }

        // Use created_at as the job date
        const jobDate = job.created_at;
        if (!jobDate || !job.status) {
          console.log(`⚠️  Skipping job - missing required fields:`, job);
          errors++;
          continue;
        }

        // Parse created_at
        const createdAt = new Date(jobDate);

        // Insert job
        const [insertedJob] = await db.insert(jobs).values({
          customerId: customerId,
          teamId: teamId,
          price: jobPrice,
          customerName: job.customer_name || null, // Visual reference
          status: job.status,
          createdAt: createdAt
        }).returning();

        // Map Excel job_id to DB job ID
        if (job.id) {
          jobIdMap[job.id] = insertedJob.id;
        }

        console.log(`✅ Imported job for customer ID ${customerId} on ${createdAt.toISOString()} (price: ${jobPrice})`);
        importedJobs++;
      } catch (error) {
        console.error(`❌ Error importing job:`, error);
        errors++;
      }
    }

    // Import time entries using the jobIdMap
    for (const entry of timeEntriesData) {
      try {
        // Get user ID - try direct ID first, then lookup by name
        let userId = null;
        if (entry.user_id && !isNaN(entry.user_id)) {
          userId = parseInt(entry.user_id);
        } else if (entry.user_name || entry.staff || entry.username) {
          const userName = entry.user_name || entry.staff || entry.username;
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

        // Get DB job ID from Excel job_id
        const dbJobId = jobIdMap[entry.job_id];
        if (!dbJobId) {
          console.log(`⚠️  Skipping time entry - job_id not found in mapping:`, entry);
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

        // Insert time entry
        await db.insert(timeEntries).values({
          userId: userId,
          jobId: dbJobId,
          clockInTime: clockInTime,
          clockOutTime: clockOutTime,
          lunchBreak: entry.lunch_break === true || entry.lunch_break === "true",
          geofenceOverride: entry.geofence_override === true || entry.geofence_override === "true",
          autoLunchDeducted: entry.auto_lunch_deducted === true || entry.auto_lunch_deducted === "true",
          staff: entry.staff || entry.user_name || null // Visual reference
        });

        console.log(`  ✅ Imported time entry for user ID ${userId} (job_id: ${dbJobId})`);
        importedTimeEntries++;
      } catch (error) {
        console.error(`❌ Error importing time entry:`, error);
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

importJobsAndTimeEntries(); 