import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { db } from "./server/db/connection.ts";
import { customers } from "./server/db/schema.ts";
import { eq, and } from "drizzle-orm";

// Load .env from the root directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: resolve(__dirname, ".env") });

async function testDuplicateCustomer() {
  try {
    console.log("🧪 Testing duplicate customer functionality...");

    // Test data
    const testCustomer = {
      name: "Test Customer",
      address: "123 Test St, Melbourne VIC 3000",
      latitude: "-37.8136",
      longitude: "144.9631",
      phone: "0412 345 678",
      price: 150,
      cleanFrequency: "weekly",
      active: true
    };

    console.log(`\n1. Creating test customer: ${testCustomer.name} at ${testCustomer.address}`);

    // First, try to create the customer
    try {
      const [newCustomer] = await db
        .insert(customers)
        .values(testCustomer)
        .returning();

      console.log(`✅ Successfully created customer with ID: ${newCustomer.id}`);
    } catch (error) {
      if (error.code === '23505') {
        console.log("⚠️  Customer already exists, continuing with test...");
      } else {
        console.error("❌ Error creating customer:", error);
        return;
      }
    }

    console.log(`\n2. Checking for existing customer: ${testCustomer.name} at ${testCustomer.address}`);

    // Check for existing customer with same name and address
    const existingCustomer = await db
      .select()
      .from(customers)
      .where(
        and(
          eq(customers.name, testCustomer.name),
          eq(customers.address, testCustomer.address)
        )
      )
      .limit(1);

    if (existingCustomer.length > 0) {
      const customer = existingCustomer[0];
      const status = customer.active ? "active" : "archived";
      console.log(`✅ Found existing customer:`);
      console.log(`   ID: ${customer.id}`);
      console.log(`   Name: ${customer.name}`);
      console.log(`   Address: ${customer.address}`);
      console.log(`   Status: ${status}`);
      console.log(`   Active: ${customer.active}`);
    } else {
      console.log("❌ No existing customer found");
    }

    // Test with a different address
    const testCustomer2 = {
      name: "Test Customer",
      address: "456 Different St, Melbourne VIC 3000"
    };

    console.log(`\n3. Checking for customer with same name but different address: ${testCustomer2.name} at ${testCustomer2.address}`);

    const existingCustomer2 = await db
      .select()
      .from(customers)
      .where(
        and(
          eq(customers.name, testCustomer2.name),
          eq(customers.address, testCustomer2.address)
        )
      )
      .limit(1);

    if (existingCustomer2.length > 0) {
      console.log("❌ Found existing customer (should not exist)");
    } else {
      console.log("✅ No existing customer found (correct behavior)");
    }

    // Test with a completely new customer
    const testCustomer3 = {
      name: "Jane Doe",
      address: "789 New St, Melbourne VIC 3000"
    };

    console.log(`\n4. Checking for completely new customer: ${testCustomer3.name} at ${testCustomer3.address}`);

    const existingCustomer3 = await db
      .select()
      .from(customers)
      .where(
        and(
          eq(customers.name, testCustomer3.name),
          eq(customers.address, testCustomer3.address)
        )
      )
      .limit(1);

    if (existingCustomer3.length > 0) {
      console.log("❌ Found existing customer (should not exist)");
    } else {
      console.log("✅ No existing customer found (correct behavior)");
    }

    console.log("\n✅ Duplicate customer test completed!");

  } catch (error) {
    console.error("❌ Error during test:", error);
  } finally {
    process.exit(0);
  }
}

testDuplicateCustomer(); 