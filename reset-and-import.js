import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import bcrypt from "bcryptjs";
import XLSX from "xlsx";
import { db } from "./server/db/connection.ts";
import { sql } from "drizzle-orm";
import { 
  users, 
  teams, 
  customers, 
  teamsUsers, 
  jobs, 
  timeEntries, 
  timeAllocationTiers,
  settings,
  sessions,
  lunchBreakOverrides
} from "./server/db/schema.ts";

function normalizeFrequency(freq) {
  if (!freq) return "weekly";
  const f = freq.toLowerCase().replace(/\s+/g, "-");
  if (f === "one-off" || f === "oneoff") return "one-off";
  if (f === "tri-weekly" || f === "triweekly") return "tri-weekly";
  if (["weekly", "fortnightly", "monthly", "one-off", "tri-weekly"].includes(f)) return f;
  return "weekly";
}

// Load .env from the root directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: resolve(__dirname, ".env") });

async function resetAndImport() {
  console.log("🗑️  Resetting database...");

  try {
    // Delete all data from all tables (in reverse dependency order)
    console.log("📝 Deleting existing data...");
    
    await db.delete(sessions);
    await db.delete(lunchBreakOverrides);
    await db.delete(timeEntries);
    await db.delete(jobs);
    await db.delete(teamsUsers);
    await db.delete(customers);
    await db.delete(teams);
    await db.delete(users);
    await db.delete(timeAllocationTiers);
    await db.delete(settings);

    console.log("✅ Database reset complete!");

    // Reset sequences to start from 1
    console.log("🔄 Resetting sequences...");
    await db.execute(sql`ALTER SEQUENCE users_id_seq RESTART WITH 1`);
    await db.execute(sql`ALTER SEQUENCE teams_id_seq RESTART WITH 1`);
    await db.execute(sql`ALTER SEQUENCE customers_id_seq RESTART WITH 1`);
    await db.execute(sql`ALTER SEQUENCE jobs_id_seq RESTART WITH 1`);
    await db.execute(sql`ALTER SEQUENCE time_entries_id_seq RESTART WITH 1`);
    await db.execute(sql`ALTER SEQUENCE time_allocation_tiers_id_seq RESTART WITH 1`);
    await db.execute(sql`ALTER SEQUENCE lunch_break_overrides_id_seq RESTART WITH 1`);

    console.log("✅ Sequences reset!");

    // Import data from Excel file
    console.log("📊 Importing data from final_upload.xlsx...");
    
    const workbook = XLSX.readFile("final_upload.xlsx");
    
    // Import customers
    if (workbook.Sheets["customers"]) {
      console.log("👥 Importing customers...");
      const customersData = XLSX.utils.sheet_to_json(workbook.Sheets["customers"]);
      
      for (const customer of customersData) {
        await db.insert(customers).values({
          name: customer.name || "",
          address: customer.address || "",
          latitude: customer.latitude || "-37.8136",
          longitude: customer.longitude || "144.9631",
          phone: customer.phone || "",
          email: customer.email || "",
          price: parseInt(customer.price) || 150,
          cleanFrequency: normalizeFrequency(customer.clean_frequency),
          notes: customer.notes || "",
          targetTimeMinutes: customer.target_time_minutes ? parseInt(customer.target_time_minutes) : null,
          averageWageRatio: customer.average_wage_ratio ? parseInt(customer.average_wage_ratio) : null,
          isFriendsFamily: customer.is_friends_family === "true" || customer.is_friends_family === true,
          friendsFamilyMinutes: customer.friends_family_minutes ? parseInt(customer.friends_family_minutes) : null,
          active: customer.active !== "false" && customer.active !== false
        });
      }
      console.log(`✅ Imported ${customersData.length} customers`);
    }

    // Import users (staff)
    if (workbook.Sheets["users"]) {
      console.log("👤 Importing users...");
      const usersData = XLSX.utils.sheet_to_json(workbook.Sheets["users"]);
      
      for (const user of usersData) {
        const hashedPassword = await bcrypt.hash("password123", 10);
        await db.insert(users).values({
          email: user.email || `user${Date.now()}@example.com`,
          passwordHash: hashedPassword,
          firstName: user.first_name || user.firstName || "",
          lastName: user.last_name || user.lastName || "",
          phone: user.phone || "",
          role: user.role || "staff",
          active: user.active !== "false" && user.active !== false
        });
      }
      console.log(`✅ Imported ${usersData.length} users`);
    }

    // Create default admin user
    console.log("👑 Creating admin user...");
    const adminPassword = await bcrypt.hash("password123", 10);
    await db.insert(users).values({
      email: "admin@example.com",
      passwordHash: adminPassword,
      firstName: "Admin",
      lastName: "User",
      role: "admin",
      active: true
    });

    // Create default teams
    console.log("👥 Creating default teams...");
    const [team1, team2] = await db.insert(teams).values([
      {
        name: "Cleaning Team A",
        colorHex: "#3b82f6",
        active: true
      },
      {
        name: "Cleaning Team B", 
        colorHex: "#10b981",
        active: true
      }
    ]).returning();

    // Assign users to teams (simple assignment - first half to team A, second half to team B)
    const allUsers = await db.select().from(users).where(sql`role = 'staff'`);
    const teamAUsers = allUsers.slice(0, Math.ceil(allUsers.length / 2));
    const teamBUsers = allUsers.slice(Math.ceil(allUsers.length / 2));

    for (const user of teamAUsers) {
      await db.insert(teamsUsers).values({
        teamId: team1.id,
        userId: user.id
      });
    }

    for (const user of teamBUsers) {
      await db.insert(teamsUsers).values({
        teamId: team2.id,
        userId: user.id
      });
    }

    console.log(`✅ Assigned ${teamAUsers.length} users to Team A and ${teamBUsers.length} users to Team B`);

    // Create default price tiers
    console.log("💰 Creating price tiers...");
    await db.insert(timeAllocationTiers).values([
      {
        priceMin: "100.00",
        priceMax: "150.00",
        allottedMinutes: 90
      },
      {
        priceMin: "151.00",
        priceMax: "200.00",
        allottedMinutes: 120
      },
      {
        priceMin: "201.00",
        priceMax: "250.00",
        allottedMinutes: 150
      },
      {
        priceMin: "251.00",
        priceMax: "300.00",
        allottedMinutes: 180
      },
      {
        priceMin: "301.00",
        priceMax: "400.00",
        allottedMinutes: 240
      }
    ]);

    // Create default settings
    console.log("⚙️  Creating default settings...");
    await db.insert(settings).values([
      {
        key: "staff_pay_rate_per_hour",
        value: "32.31"
      },
      {
        key: "company_name",
        value: "MyHome CleanTeam"
      }
    ]);

    console.log("✅ Database reset and import complete!");
    console.log("📧 Admin login: admin@example.com");
    console.log("🔑 Password: password123");
    console.log("📧 Staff login: Use any staff email from the Excel file");
    console.log("🔑 Password: password123");
    
  } catch (error) {
    console.error("❌ Error during reset and import:", error);
    process.exit(1);
  }
  
  process.exit(0);
}

resetAndImport(); 