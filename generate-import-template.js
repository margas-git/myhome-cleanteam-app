import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import XLSX from "xlsx";
import { db } from "./server/db/connection.ts";
import { customers, users, teams } from "./server/db/schema.ts";

// Load .env from the root directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: resolve(__dirname, ".env") });

async function generateImportTemplate() {
  try {
    console.log("📊 Generating import template...");

    // Get all customers
    const allCustomers = await db
      .select({
        id: customers.id,
        name: customers.name,
        address: customers.address
      })
      .from(customers)
      .orderBy(customers.name);

    // Get all users
    const allUsers = await db
      .select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
        role: users.role
      })
      .from(users)
      .orderBy(users.firstName);

    // Get all teams
    const allTeams = await db
      .select({
        id: teams.id,
        name: teams.name
      })
      .from(teams)
      .orderBy(teams.name);

    // Create workbook
    const workbook = XLSX.utils.book_new();

    // Create jobs template sheet with VLOOKUP formulas
    const jobsTemplate = [
      {
        customer_name: "",
        customer_id: "",
        team_name: "",
        team_id: "",
        scheduled_date: "",
        start_time: "",
        end_time: "",
        status: "completed"
      }
    ];

    // Create time entries template sheet with VLOOKUP formulas
    const timeEntriesTemplate = [
      {
        customer_name: "",
        customer_id: "",
        scheduled_date: "",
        user_name: "",
        user_id: "",
        clock_in_time: "",
        clock_out_time: "",
        lunch_break: false,
        geofence_override: false,
        auto_lunch_deducted: false
      }
    ];

    // Create reference sheets
    const customersReference = allCustomers.map(c => ({
      id: c.id,
      name: c.name,
      address: c.address
    }));

    const usersReference = allUsers.map(u => ({
      id: u.id,
      name: `${u.firstName} ${u.lastName}`,
      email: u.email,
      role: u.role
    }));

    const teamsReference = allTeams.map(t => ({
      id: t.id,
      name: t.name
    }));

    // Add sheets to workbook
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(jobsTemplate), "jobs");
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(timeEntriesTemplate), "time_entries");
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(customersReference), "customers_reference");
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(usersReference), "users_reference");
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(teamsReference), "teams_reference");

    // Write to file
    XLSX.writeFile(workbook, "historical-cleans-template.xlsx");

    console.log("✅ Template generated: historical-cleans-template.xlsx");
    console.log(`📋 Contains ${allCustomers.length} customers, ${allUsers.length} users, and ${allTeams.length} teams`);
    console.log("\n📝 Instructions:");
    console.log("1. Open historical-cleans-template.xlsx");
    console.log("2. In the 'jobs' sheet:");
    console.log("   - Enter customer names in column A (use dropdown or type)");
    console.log("   - Enter team names in column C (use dropdown or type)");
    console.log("   - Fill in dates, times, and status");
    console.log("3. In the 'time_entries' sheet:");
    console.log("   - Enter customer names and scheduled dates to match jobs");
    console.log("   - Enter user names in column D (use dropdown or type)");
    console.log("   - Fill in clock times and other details");
    console.log("4. The VLOOKUP formulas will automatically populate the IDs");
    console.log("5. Save as 'historical-cleans.xlsx'");
    console.log("6. Run the import script");

    // Create enhanced template with formulas
    console.log("\n🔄 Creating enhanced template with formulas...");
    
    // Create a new workbook for the enhanced version
    const enhancedWorkbook = XLSX.utils.book_new();
    
    // Create jobs sheet with formulas
    const jobsWithFormulas = [
      {
        customer_name: "",
        customer_id: "=VLOOKUP(A2,customers_reference!A:C,1,FALSE)",
        team_name: "",
        team_id: "=VLOOKUP(C2,teams_reference!A:B,1,FALSE)",
        scheduled_date: "",
        start_time: "",
        end_time: "",
        status: "completed"
      }
    ];

    // Create time entries sheet with formulas
    const timeEntriesWithFormulas = [
      {
        customer_name: "",
        customer_id: "=VLOOKUP(A2,customers_reference!A:C,1,FALSE)",
        scheduled_date: "",
        user_name: "",
        user_id: "=VLOOKUP(D2,users_reference!A:B,1,FALSE)",
        clock_in_time: "",
        clock_out_time: "",
        lunch_break: false,
        geofence_override: false,
        auto_lunch_deducted: false
      }
    ];

    // Add sheets to enhanced workbook
    XLSX.utils.book_append_sheet(enhancedWorkbook, XLSX.utils.json_to_sheet(jobsWithFormulas), "jobs");
    XLSX.utils.book_append_sheet(enhancedWorkbook, XLSX.utils.json_to_sheet(timeEntriesWithFormulas), "time_entries");
    XLSX.utils.book_append_sheet(enhancedWorkbook, XLSX.utils.json_to_sheet(customersReference), "customers_reference");
    XLSX.utils.book_append_sheet(enhancedWorkbook, XLSX.utils.json_to_sheet(usersReference), "users_reference");
    XLSX.utils.book_append_sheet(enhancedWorkbook, XLSX.utils.json_to_sheet(teamsReference), "teams_reference");

    // Write enhanced template
    XLSX.writeFile(enhancedWorkbook, "historical-cleans-template-enhanced.xlsx");

    console.log("✅ Enhanced template generated: historical-cleans-template-enhanced.xlsx");
    console.log("📝 This version includes VLOOKUP formulas for automatic ID population");

  } catch (error) {
    console.error("❌ Error generating template:", error);
  }
}

generateImportTemplate(); 