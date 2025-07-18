import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import bcrypt from "bcryptjs";
import { db } from "./db/connection.js";
import { users, teams, customers, teamsUsers, jobs, timeEntries, timeAllocationTiers } from "./db/schema.js";

// Load .env from the root directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: resolve(__dirname, "../../.env") });

async function seed() {
  console.log("🌱 Seeding database...");

  // Create test users
  const hashedPassword = await bcrypt.hash("password123", 10);
  const [user] = await db.insert(users).values({
    email: "test@example.com",
    passwordHash: hashedPassword,
    firstName: "Test",
    lastName: "User",
    role: "staff"
  }).returning();

  // Create admin user
  const [adminUser] = await db.insert(users).values({
    email: "admin@example.com",
    passwordHash: hashedPassword,
    firstName: "Admin",
    lastName: "User",
    role: "admin"
  }).returning();

  // Create a test team
  const [team] = await db.insert(teams).values({
    name: "Cleaning Team A",
    colorHex: "#3b82f6"
  }).returning();

  // Add user to team
  await db.insert(teamsUsers).values({
    teamId: team.id,
    userId: user.id
  });

  // Create default price tiers
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

  // Create test customers
  const [customer1, customer2] = await db.insert(customers).values([
    {
      name: "John Smith",
      address: "123 Main St, Melbourne VIC 3000",
      latitude: "-37.8136",
      longitude: "144.9631",
      phone: "0412 345 678",
      price: 150,
      active: true
    },
    {
      name: "Sarah Johnson",
      address: "456 Collins St, Melbourne VIC 3000",
      latitude: "-37.8142",
      longitude: "144.9722",
      phone: "0423 456 789", 
      price: 220,
      active: true
    }
  ]).returning();

  // Create test jobs
  const [job1, job2, job3] = await db.insert(jobs).values([
    {
      customerId: customer1.id,
      teamId: team.id,
      status: "completed"
    },
    {
      customerId: customer2.id,
      teamId: team.id,
      status: "completed"
    },
    {
      customerId: customer1.id,
      teamId: team.id,
      status: "completed"
    }
  ]).returning();

  // Create test time entries for this week
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
  
  // Calculate Monday of this week
  const mondayOfThisWeek = new Date(today.getTime() - dayOfWeek * 24 * 60 * 60 * 1000);
  
  // Create time entries for different days this week
  await db.insert(timeEntries).values([
    // Monday - 8 hours
    {
      userId: user.id,
      jobId: job1.id,
      clockInTime: new Date(mondayOfThisWeek.getTime() + 8 * 60 * 60 * 1000), // 8 AM
      clockOutTime: new Date(mondayOfThisWeek.getTime() + 16 * 60 * 60 * 1000), // 4 PM
      lunchBreak: false,
      autoLunchDeducted: false
    },
    // Tuesday - 9 hours (1 hour overtime)
    {
      userId: user.id,
      jobId: job2.id,
      clockInTime: new Date(mondayOfThisWeek.getTime() + 24 * 60 * 60 * 1000 + 8 * 60 * 60 * 1000), // Tuesday 8 AM
      clockOutTime: new Date(mondayOfThisWeek.getTime() + 24 * 60 * 60 * 1000 + 17 * 60 * 60 * 1000), // Tuesday 5 PM
      lunchBreak: false,
      autoLunchDeducted: false
    },
    // Wednesday - 7 hours
    {
      userId: user.id,
      jobId: job3.id,
      clockInTime: new Date(mondayOfThisWeek.getTime() + 48 * 60 * 60 * 1000 + 9 * 60 * 60 * 1000), // Wednesday 9 AM
      clockOutTime: new Date(mondayOfThisWeek.getTime() + 48 * 60 * 60 * 1000 + 16 * 60 * 60 * 1000), // Wednesday 4 PM
      lunchBreak: false,
      autoLunchDeducted: false
    }
  ]);

  console.log("✅ Database seeded successfully!");
  console.log("📧 Staff login: test@example.com");
  console.log("📧 Admin login: admin@example.com");
  console.log("🔑 Password: password123");
  
  process.exit(0);
}

seed().catch(console.error); 