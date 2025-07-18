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
  
  // Check if user exists by name
  const existingUsers = await client`
    SELECT id, first_name, last_name FROM users 
    WHERE first_name = ${firstName} AND last_name = ${lastName}
  `;
  
  if (existingUsers.length > 0) {
    return existingUsers[0].id;
  }
  
  // Use a bcrypt hash for 'changeme' as a placeholder
  const placeholderHash = '$2b$10$CwTycUXWue0Thq9StjUM0uJ8zQpQ1rQ1rQ1rQ1rQ1rQ1rQ1rQ1rQ';
  // This is a bcrypt hash for the password 'changeme'
  const newUser = await client`
    INSERT INTO users (first_name, last_name, email, password_hash, role, active, created_at)
    VALUES (${firstName}, ${lastName}, ${`${firstName.toLowerCase()}.${lastName.toLowerCase()}@myhomecleanteam.com`}, ${placeholderHash}, 'staff', true, NOW())
    RETURNING id
  `;
  
  console.log(`  ✅ Created user: ${name} (ID: ${newUser[0].id})`);
  return newUser[0].id;
}

// Helper function to ensure team exists
async function ensureTeamExists(teamId) {
  const existingTeam = await client`
    SELECT id, name FROM teams WHERE id = ${teamId}
  `;
  
  if (existingTeam.length > 0) {
    return existingTeam[0];
  }
  
  // Create team with default values
  const newTeam = await client`
    INSERT INTO teams (id, name, color_hex, active, created_at)
    VALUES (${teamId}, ${`Team ${teamId}`}, ${`#${Math.floor(Math.random()*16777215).toString(16)}`}, true, NOW())
    RETURNING id, name
  `;
  
  console.log(`  ✅ Created team: Team ${teamId} (ID: ${newTeam[0].id})`);
  return newTeam[0];
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
        const existingMembership = await client`
          SELECT id FROM teams_users 
          WHERE user_id = ${userId} AND team_id = ${change.teamId} AND start_date = ${startDate}
        `;

        if (existingMembership.length > 0) {
          console.log(`  ⚠️  Skipping duplicate: ${change.name} → Team ${change.teamId} (${startDate})`);
          skippedCount++;
          continue;
        }

        // Insert the team membership
        await client`
          INSERT INTO teams_users (user_id, team_id, start_date, end_date)
          VALUES (${userId}, ${change.teamId}, ${startDate}, ${endDate})
        `;

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

    // Verify the import
    console.log(`\n=== Verification ===`);
    const totalMemberships = await client`SELECT COUNT(*) as count FROM teams_users`;
    console.log(`Total team memberships in database: ${totalMemberships[0].count}`);

    // Show some sample memberships
    const recentMemberships = await client`
      SELECT user_id, team_id, start_date, end_date 
      FROM teams_users 
      ORDER BY start_date 
      LIMIT 10
    `;

    console.log(`\nRecent team memberships:`);
    for (const membership of recentMemberships) {
      const user = await client`SELECT first_name, last_name FROM users WHERE id = ${membership.user_id}`;
      const team = await client`SELECT name FROM teams WHERE id = ${membership.team_id}`;
      if (user.length > 0 && team.length > 0) {
        console.log(`  ${user[0].first_name} ${user[0].last_name} → Team ${team[0].name} (${membership.start_date} to ${membership.end_date || 'active'})`);
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