import { db } from "../server/db/connection.ts";
import { sql } from "drizzle-orm";
import XLSX from "xlsx";
import { customers, jobs, timeEntries } from "../server/db/schema.ts";

async function importExportedData() {
  try {
    console.log("🗑️  Clearing customers, jobs, and time_entries tables...");
    
    // Clear the tables in the correct order (respecting foreign key constraints)
    await db.execute(sql`DELETE FROM time_entries`);
    console.log("✅ Cleared time_entries table");
    
    await db.execute(sql`DELETE FROM jobs`);
    console.log("✅ Cleared jobs table");
    
    await db.execute(sql`DELETE FROM customers`);
    console.log("✅ Cleared customers table");
    
    console.log("📊 Importing data from MyHome_Data.xlsx...");
    
    // Read the Excel file
    const workbook = XLSX.readFile("MyHome_Data.xlsx");
    
    // Import customers first
    console.log("📋 Importing customers...");
    const customersSheet = workbook.Sheets["customers"];
    const customersData = XLSX.utils.sheet_to_json(customersSheet);
    
    for (const customer of customersData) {
      // Map clean_frequency values to match enum
      let cleanFrequency = customer.clean_frequency || "weekly";
      if (cleanFrequency === "Fortnightly") cleanFrequency = "fortnightly";
      if (cleanFrequency === "Tri-weekly") cleanFrequency = "tri-weekly";
      if (cleanFrequency === "One off") cleanFrequency = "one-off";
      if (cleanFrequency === "Weekly") cleanFrequency = "weekly";
      if (cleanFrequency === "Monthly") cleanFrequency = "monthly";
      
      await db.insert(customers).values({
        id: customer.id,
        name: customer.name,
        address: customer.address || "",
        latitude: customer.latitude || "",
        longitude: customer.longitude || "",
        phone: customer.phone || null,
        email: customer.email || null,
        price: customer.price || 0,
        cleanFrequency: cleanFrequency,
        notes: customer.notes || null,
        targetTimeMinutes: customer.target_time_minutes || null,
        averageWageRatio: customer.average_wage_ratio || null,
        isFriendsFamily: customer.is_friends_family || false,
        friendsFamilyMinutes: customer.friends_family_minutes || null,
        active: customer.active || true,
        createdAt: new Date(customer.created_at)
      });
    }
    console.log(`✅ Imported ${customersData.length} customers`);
    
    // Import jobs
    console.log("📋 Importing jobs...");
    const jobsSheet = workbook.Sheets["jobs"];
    const jobsData = XLSX.utils.sheet_to_json(jobsSheet);
    
    for (const job of jobsData) {
      // Parse JSON fields safely
      let teamMembersAtCreation = null;
      let additionalStaff = null;
      
      try {
        if (job.team_members_at_creation) {
          // Replace single quotes with double quotes for valid JSON
          const teamMembersStr = String(job.team_members_at_creation).replace(/'/g, '"');
          teamMembersAtCreation = JSON.parse(teamMembersStr);
        }
      } catch (e) {
        console.log(`Warning: Could not parse team_members_at_creation for job ${job.id}: ${job.team_members_at_creation}`);
      }
      
      try {
        if (job.additional_staff) {
          // Replace single quotes with double quotes for valid JSON
          const additionalStaffStr = String(job.additional_staff).replace(/'/g, '"');
          additionalStaff = JSON.parse(additionalStaffStr);
        }
      } catch (e) {
        console.log(`Warning: Could not parse additional_staff for job ${job.id}: ${job.additional_staff}`);
      }
      
      await db.insert(jobs).values({
        id: job.id,
        customerId: job.customer_id || null,
        teamId: job.team_id ? parseInt(job.team_id) : null,
        price: job.price || null,
        customerName: job.customer_name || null,
        teamMembersAtCreation: teamMembersAtCreation,
        additionalStaff: additionalStaff,
        status: job.status || "completed",
        createdAt: new Date(job.created_at)
      });
    }
    console.log(`✅ Imported ${jobsData.length} jobs`);
    
    // Import time entries
    console.log("📋 Importing time entries...");
    const timeEntriesSheet = workbook.Sheets["time_entries"];
    const timeEntriesData = XLSX.utils.sheet_to_json(timeEntriesSheet);
    
    for (const timeEntry of timeEntriesData) {
      await db.insert(timeEntries).values({
        id: timeEntry.id,
        userId: timeEntry.user_id || null,
        jobId: timeEntry.job_id,
        clockInTime: timeEntry.clock_in_time ? new Date(timeEntry.clock_in_time) : null,
        clockOutTime: timeEntry.clock_out_time ? new Date(timeEntry.clock_out_time) : null,
        lunchBreak: timeEntry.lunch_break || false,
        geofenceOverride: timeEntry.geofence_override || false,
        autoLunchDeducted: timeEntry.auto_lunch_deducted || false,
        staff: timeEntry.staff || null
      });
    }
    console.log(`✅ Imported ${timeEntriesData.length} time entries`);
    
    console.log("🎉 Import completed successfully!");
    console.log(`📊 Summary:`);
    console.log(`   - ${customersData.length} customers imported`);
    console.log(`   - ${jobsData.length} jobs imported`);
    console.log(`   - ${timeEntriesData.length} time entries imported`);
    
  } catch (error) {
    console.error("❌ Error during import:", error);
  } finally {
    process.exit(0);
  }
}

importExportedData(); 