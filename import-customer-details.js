import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import XLSX from "xlsx";
import { db } from "./server/db/connection.ts";
import { customers } from "./server/db/schema.ts";
import { sql } from "drizzle-orm";

// Load .env from the root directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: resolve(__dirname, ".env") });

async function importCustomerDetails() {
  try {
    console.log("🗑️  Dropping customers table...");
    
    // Drop the customers table
    await db.execute(sql`DROP TABLE IF EXISTS customers CASCADE`);
    console.log("✅ Customers table dropped");
    
    // Recreate the customers table using the schema
    await db.execute(sql`
      CREATE TABLE customers (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        address TEXT NOT NULL,
        latitude VARCHAR(64) NOT NULL,
        longitude VARCHAR(64) NOT NULL,
        phone VARCHAR(32),
        email VARCHAR(255),
        price INTEGER NOT NULL,
        clean_frequency clean_frequency DEFAULT 'weekly' NOT NULL,
        notes TEXT,
        target_time_minutes INTEGER,
        average_wage_ratio INTEGER,
        is_friends_family BOOLEAN DEFAULT false,
        friends_family_minutes INTEGER,
        active BOOLEAN DEFAULT true NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
      )
    `);
    console.log("✅ Customers table recreated");
    
    console.log("📊 Importing customer details from Excel...");
    
    // Read the Excel file
    const workbook = XLSX.readFile("team-changes/customer_details.xlsx");
    
    // Get the first sheet (or specify sheet name if needed)
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    if (!worksheet) {
      console.error("❌ No worksheet found in customer_details.xlsx");
      return;
    }
    
    const customerData = XLSX.utils.sheet_to_json(worksheet);
    console.log(`📋 Found ${customerData.length} customers to import`);
    
    if (customerData.length === 0) {
      console.log("❌ No customer data found in the Excel file");
      return;
    }
    
    let importedCustomers = 0;
    let errors = 0;
    
    // Import customers
    for (const customer of customerData) {
      try {
        // Parse and validate data
        const customerRecord = {
          name: customer.name || customer.Name || customer.CUSTOMER_NAME,
          address: customer.address || customer.Address || customer.ADDRESS,
          latitude: customer.latitude || customer.Latitude || customer.LATITUDE || "0",
          longitude: customer.longitude || customer.Longitude || customer.LONGITUDE || "0",
          phone: customer.phone || customer.Phone || customer.PHONE,
          email: customer.email || customer.Email || customer.EMAIL,
          price: parseInt(customer.price || customer.Price || customer.PRICE || "0"),
          cleanFrequency: (() => {
            const freq = (customer.clean_frequency || customer.cleanFrequency || customer.CLEAN_FREQUENCY || "weekly").trim().toLowerCase();
            // Map common values to enum values
            if (freq.includes("monthly")) return "monthly";
            if (freq.includes("weekly")) return "weekly";
            if (freq.includes("fortnightly")) return "fortnightly";
            if (freq.includes("tri-weekly")) return "tri-weekly";
            if (freq.includes("one-off")) return "one-off";
            return "weekly"; // default
          })(),
          notes: customer.notes || customer.Notes || customer.NOTES,
          targetTimeMinutes: customer.target_time_minutes || customer.targetTimeMinutes || customer.TARGET_TIME_MINUTES,
          averageWageRatio: customer.average_wage_ratio || customer.averageWageRatio || customer.AVERAGE_WAGE_RATIO,
          isFriendsFamily: customer.is_friends_family === true || customer.isFriendsFamily === true || customer.IS_FRIENDS_FAMILY === true,
          friendsFamilyMinutes: customer.friends_family_minutes || customer.friendsFamilyMinutes || customer.FRIENDS_FAMILY_MINUTES,
          active: customer.active !== false && customer.Active !== false && customer.ACTIVE !== false
        };
        
        // Validate required fields
        if (!customerRecord.name || !customerRecord.address) {
          console.log(`⚠️  Skipping customer - missing required fields:`, customer);
          errors++;
          continue;
        }
        
        // Insert customer
        await db.insert(customers).values(customerRecord);
        
        console.log(`✅ Imported customer: ${customerRecord.name}`);
        importedCustomers++;
        
      } catch (error) {
        console.error(`❌ Error importing customer:`, error);
        console.error(`Customer data:`, customer);
        errors++;
      }
    }
    
    console.log(`\n📈 Import Summary:`);
    console.log(`✅ Successfully imported: ${importedCustomers} customers`);
    console.log(`❌ Errors: ${errors}`);
    
  } catch (error) {
    console.error("❌ Error during import:", error);
  }
}

importCustomerDetails(); 