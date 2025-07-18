require('dotenv').config();
const { drizzle } = require('drizzle-orm/postgres-js');
const postgres = require('postgres');
const XLSX = require('xlsx');

const sql = postgres(process.env.DATABASE_URL);
const db = drizzle(sql);

async function importExportedData() {
  try {
    console.log("📊 Importing data from MyHome_Data.xlsx...");
    
    // Read the Excel file
    const workbook = XLSX.readFile("team-changes/MyHome_Data.xlsx");
    
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
      
      await sql`
        INSERT INTO customers (
          id, name, address, latitude, longitude, phone, email, price, 
          clean_frequency, notes, target_time_minutes, average_wage_ratio, 
          is_friends_family, friends_family_minutes, active, created_at
        ) VALUES (
          ${customer.id}, ${customer.name}, ${customer.address || ""}, 
          ${customer.latitude || ""}, ${customer.longitude || ""}, 
          ${customer.phone || null}, ${customer.email || null}, 
          ${customer.price || 0}, ${cleanFrequency}, ${customer.notes || null}, 
          ${customer.target_time_minutes || null}, ${customer.average_wage_ratio || null}, 
          ${customer.is_friends_family || false}, ${customer.friends_family_minutes || null}, 
          ${customer.active || true}, ${new Date(customer.created_at)}
        )
      `;
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
          teamMembersAtCreation = JSON.parse(job.team_members_at_creation);
        }
      } catch (e) {
        console.log(`Warning: Could not parse team_members_at_creation for job ${job.id}: ${job.team_members_at_creation}`);
        teamMembersAtCreation = [];
      }
      
      try {
        if (job.additional_staff) {
          additionalStaff = JSON.parse(job.additional_staff);
        }
      } catch (e) {
        console.log(`Warning: Could not parse additional_staff for job ${job.id}: ${job.additional_staff}`);
        additionalStaff = [];
      }
      
      await sql`
        INSERT INTO jobs (
          id, customer_id, team_id, price, customer_name, 
          team_members_at_creation, additional_staff, status, created_at
        ) VALUES (
          ${job.id}, ${job.customer_id || null}, ${job.team_id ? parseInt(job.team_id) : null}, 
          ${job.price || null}, ${job.customer_name || null}, 
          ${JSON.stringify(teamMembersAtCreation)}, ${JSON.stringify(additionalStaff)}, 
          ${job.status || "completed"}, ${new Date(job.created_at)}
        )
      `;
    }
    console.log(`✅ Imported ${jobsData.length} jobs`);
    
    // Import time entries
    console.log("📋 Importing time entries...");
    const timeEntriesSheet = workbook.Sheets["time_entries"];
    const timeEntriesData = XLSX.utils.sheet_to_json(timeEntriesSheet);
    
    for (const timeEntry of timeEntriesData) {
      await sql`
        INSERT INTO time_entries (
          id, user_id, job_id, clock_in_time, clock_out_time, 
          lunch_break, geofence_override, auto_lunch_deducted, staff
        ) VALUES (
          ${timeEntry.id}, ${timeEntry.user_id || null}, ${timeEntry.job_id}, 
          ${timeEntry.clock_in_time ? new Date(timeEntry.clock_in_time) : null}, 
          ${timeEntry.clock_out_time ? new Date(timeEntry.clock_out_time) : null}, 
          ${timeEntry.lunch_break || false}, ${timeEntry.geofence_override || false}, 
          ${timeEntry.auto_lunch_deducted || false}, ${timeEntry.staff || null}
        )
      `;
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
    await sql.end();
  }
}

importExportedData(); 