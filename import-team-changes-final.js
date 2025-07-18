import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { config } from "dotenv";
import { resolve, dirname } from "path";

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: resolve(__dirname, ".env") });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL environment variable is required");
}

const client = postgres(connectionString);
const db = drizzle(client);

// Simple schema definition for import
const schema = {
  users: { id: 'id', firstName: 'first_name', lastName: 'last_name', email: 'email', role: 'role', active: 'active', createdAt: 'created_at' },
  teams: { id: 'id', name: 'name', colorHex: 'color_hex', active: 'active', createdAt: 'created_at' },
  teamsUsers: { teamId: 'team_id', userId: 'user_id', startDate: 'start_date', endDate: 'end_date', createdAt: 'created_at' }
};

// Parse command line args for dry run
const dryRun = process.argv.includes('--dry-run');
if (dryRun) {
  console.log('=== DRY RUN MODE: No changes will be made to the database ===');
}

// Helper function to convert DD/MM/YYYY to YYYY-MM-DD
function convertDate(dateStr) {
  if (!dateStr || dateStr === 'NULL' || dateStr === '') return null;
  const parts = dateStr.split('/');
  if (parts.length !== 3) return null;
  return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
}

// Helper function to create user if doesn't exist
async function ensureUserExists(name) {
  const [firstName, ...lastNameParts] = name.split(' ');
  const lastName = lastNameParts.join(' ') || '';
  
  // Check if user exists
  const existingUser = await client`SELECT * FROM users WHERE first_name = ${firstName} AND last_name = ${lastName}`;
  
  if (existingUser.length > 0) {
    return existingUser[0].id;
  }
  
  if (dryRun) {
    console.log(`  [DRY RUN] Would create user: ${name}`);
    return null; // No real userId
  }
  
  // Create new user
  const [newUser] = await client`INSERT INTO users (first_name, last_name, email, password_hash, role, active, created_at) 
    VALUES (${firstName}, ${lastName}, ${`${firstName.toLowerCase()}.${lastName.toLowerCase()}@myhomecleanteam.com`}, 
    '${'$2b$10$placeholder.hash.for.import.script'}', 'staff', true, ${new Date()}) 
    RETURNING *`;
  
  console.log(`  ✅ Created user: ${name} (ID: ${newUser.id})`);
  return newUser.id;
}

// Helper function to ensure team exists
async function ensureTeamExists(teamId) {
  const existingTeam = await client`SELECT * FROM teams WHERE id = ${teamId}`;
  
  if (existingTeam.length > 0) {
    return existingTeam[0];
  }
  
  if (dryRun) {
    console.log(`  [DRY RUN] Would create team: Team ${teamId}`);
    return null;
  }
  
  // Create team with default values
  const [newTeam] = await client`INSERT INTO teams (id, name, color_hex, active, created_at) 
    VALUES (${teamId}, ${`Team ${teamId}`}, ${`#${Math.floor(Math.random()*16777215).toString(16)}`}, true, ${new Date()}) 
    RETURNING *`;
  
  console.log(`  ✅ Created team: Team ${teamId} (ID: ${newTeam.id})`);
  return newTeam;
}

async function importTeamChanges() {
  try {
    console.log("=== Team Changes Import Script ===\n");

    // Read the CSV file
    const csvPath = path.join(__dirname, 'team-changes', 'team_id_tracker.csv');
    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    
    // Parse CSV
    const lines = csvContent.split('\n').filter(line => line.trim());
    const data = lines.slice(1).filter(line => line.trim() && !line.startsWith(','));
    
    console.log(`Found ${data.length} team change records\n`);

    // Parse the data
    const teamChanges = [];
    const uniqueNames = new Set();
    const uniqueTeams = new Set();
    
    for (const line of data) {
      const values = line.split(',');
      if (values.length < 5) continue;
      
      const teamId = parseInt(values[0]);
      const name = values[1].trim();
      const startDate = values[2].trim();
      const endDate = values[3].trim();
      const status = values[4].trim();
      
      if (!name || name === 'name') continue; // Skip header or empty rows
      
      teamChanges.push({
        teamId,
        name,
        startDate,
        endDate,
        status
      });
      
      uniqueNames.add(name);
      uniqueTeams.add(teamId);
    }

    console.log(`=== Data Summary ===`);
    console.log(`Total team changes: ${teamChanges.length}`);
    console.log(`Unique staff members: ${uniqueNames.size}`);
    console.log(`Unique teams: ${uniqueTeams.size}`);

    // Ensure all teams exist
    console.log(`\n=== Ensuring Teams Exist ===`);
    for (const teamId of uniqueTeams) {
      await ensureTeamExists(teamId);
    }

    // Ensure all users exist
    console.log(`\n=== Ensuring Users Exist ===`);
    const userMap = new Map();
    for (const name of uniqueNames) {
      const userId = await ensureUserExists(name);
      userMap.set(name, userId);
    }

    // Import team memberships
    console.log(`\n=== Importing Team Memberships ===`);
    let importedCount = 0;
    let skippedCount = 0;

    for (const change of teamChanges) {
      const userId = userMap.get(change.name);
      const startDate = convertDate(change.startDate);
      const endDate = convertDate(change.endDate);
      
      if (!startDate) {
        console.log(`  ⚠️  Skipping ${change.name} - invalid start date: ${change.startDate}`);
        skippedCount++;
        continue;
      }

      try {
        // Check if this membership already exists
        const existingMembership = await client`SELECT * FROM teams_users 
          WHERE user_id = ${userId} AND team_id = ${change.teamId} AND start_date = ${startDate}`;

        if (existingMembership.length > 0) {
          console.log(`  ⚠️  Skipping duplicate: ${change.name} → Team ${change.teamId} (${startDate})`);
          skippedCount++;
          continue;
        }

        if (dryRun) {
          console.log(`  [DRY RUN] Would import: ${change.name} → Team ${change.teamId} (${startDate} to ${endDate || 'active'})`);
          importedCount++;
          continue;
        }

        // Insert the team membership
        await client`INSERT INTO teams_users (user_id, team_id, start_date, end_date) 
          VALUES (${userId}, ${change.teamId}, ${startDate}, ${endDate})`;

        console.log(`  ✅ Imported: ${change.name} → Team ${change.teamId} (${startDate} to ${endDate || 'active'})`);
        importedCount++;

      } catch (error) {
        console.log(`  ❌ Error importing ${change.name} → Team ${change.teamId}: ${error.message}`);
        skippedCount++;
      }
    }

    console.log(`\n=== Import Complete ===`);
    console.log(`✅ Successfully imported: ${importedCount} team memberships`);
    console.log(`⚠️  Skipped: ${skippedCount} records (duplicates or errors)`);
    console.log(`📊 Total processed: ${teamChanges.length} records`);

    // Only verify if not dry run
    if (!dryRun) {
      console.log(`\n=== Verification ===`);
      const totalMemberships = await client`SELECT COUNT(*) as count FROM teams_users`;
      console.log(`Total team memberships in database: ${totalMemberships[0].count}`);

      // Show some sample memberships
      const recentMemberships = await client`SELECT user_id, team_id, start_date, end_date 
        FROM teams_users ORDER BY start_date LIMIT 10`;

      console.log(`\nRecent team memberships:`);
      for (const membership of recentMemberships) {
        const user = await client`SELECT * FROM users WHERE id = ${membership.user_id}`;
        const team = await client`SELECT * FROM teams WHERE id = ${membership.team_id}`;
        if (user.length > 0 && team.length > 0) {
          console.log(`  ${user[0].first_name} ${user[0].last_name} → Team ${team[0].name} (${membership.start_date} to ${membership.end_date || 'active'})`);
        }
      }
    }

    console.log(`\n🎉 Import completed successfully!`);
    console.log(`You can now view historical team composition in the admin dashboard.`);

  } catch (error) {
    console.error("Error importing team changes:", error);
  } finally {
    await client.end();
  }
}

importTeamChanges(); 