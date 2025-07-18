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

// Helper function to ensure team exists
async function ensureTeamExists(teamId) {
  const existingTeam = await client`SELECT * FROM teams WHERE id = ${teamId}`;
  
  if (existingTeam.length > 0) {
    return existingTeam[0];
  }
  
  // Create team with default values
  const [newTeam] = await client`INSERT INTO teams (id, name, color_hex, active, created_at) 
    VALUES (${teamId}, ${`Team ${teamId}`}, ${`#${Math.floor(Math.random()*16777215).toString(16)}`}, true, ${new Date()}) 
    RETURNING *`;
  
  console.log(`  ✅ Created team: Team ${teamId} (ID: ${newTeam.id})`);
  return newTeam;
}

async function importUsersAndTeams() {
  try {
    console.log("=== Users and Teams Import Script ===\n");

    // Step 1: Import Users
    console.log("=== Step 1: Importing Users ===\n");
    
    const usersPath = path.join(__dirname, 'team-changes', 'users.csv');
    const usersContent = fs.readFileSync(usersPath, 'utf-8');
    
    // Parse CSV
    const userLines = usersContent.split('\n').filter(line => line.trim());
    const userData = userLines.slice(1).filter(line => line.trim() && !line.startsWith(','));
    
    console.log(`Found ${userData.length} users to import\n`);

    let importedUsers = 0;
    let skippedUsers = 0;

    for (const line of userData) {
      const values = line.split(',');
      if (values.length < 8) continue;
      
      const id = parseInt(values[0]);
      const email = values[1].trim();
      const passwordHash = values[2].trim();
      const firstName = values[3].trim();
      const lastName = values[4].trim();
      const phone = values[5].trim() || null;
      const role = values[6].trim();
      const active = values[7].trim().toLowerCase() === 'true';
      const createdAt = values[8].trim();
      
      if (!email || email === 'email') continue; // Skip header or empty rows
      
      try {
        // Check if user already exists
        const existingUser = await client`SELECT * FROM users WHERE email = ${email}`;
        
        if (existingUser.length > 0) {
          console.log(`  ⚠️  Skipping duplicate user: ${firstName} ${lastName} (${email})`);
          skippedUsers++;
          continue;
        }

        // Insert the user
        await client`INSERT INTO users (id, email, password_hash, first_name, last_name, phone, role, active, created_at) 
          VALUES (${id}, ${email}, ${passwordHash}, ${firstName}, ${lastName}, ${phone}, ${role}, ${active}, ${createdAt})`;

        console.log(`  ✅ Imported user: ${firstName} ${lastName} (${email}) - ${role}`);
        importedUsers++;

      } catch (error) {
        console.log(`  ❌ Error importing user ${firstName} ${lastName}: ${error.message}`);
        skippedUsers++;
      }
    }

    console.log(`\n=== Users Import Complete ===`);
    console.log(`✅ Successfully imported: ${importedUsers} users`);
    console.log(`⚠️  Skipped: ${skippedUsers} users (duplicates or errors)`);

    // Step 2: Import Team Membership Data
    console.log(`\n=== Step 2: Importing Team Membership Data ===\n`);
    
    const teamsPath = path.join(__dirname, 'team-changes', 'team_id_tracker.csv');
    const teamsContent = fs.readFileSync(teamsPath, 'utf-8');
    
    // Parse CSV
    const teamLines = teamsContent.split('\n').filter(line => line.trim());
    const teamData = teamLines.slice(1).filter(line => line.trim() && !line.startsWith(','));
    
    console.log(`Found ${teamData.length} team membership records\n`);

    // Parse the data
    const teamChanges = [];
    const uniqueTeams = new Set();
    
    for (const line of teamData) {
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
      
      uniqueTeams.add(teamId);
    }

    console.log(`=== Team Data Summary ===`);
    console.log(`Total team changes: ${teamChanges.length}`);
    console.log(`Unique teams: ${uniqueTeams.size}`);

    // Ensure all teams exist
    console.log(`\n=== Ensuring Teams Exist ===`);
    for (const teamId of uniqueTeams) {
      await ensureTeamExists(teamId);
    }

    // Import team memberships
    console.log(`\n=== Importing Team Memberships ===`);
    let importedMemberships = 0;
    let skippedMemberships = 0;

    for (const change of teamChanges) {
      const startDate = convertDate(change.startDate);
      const endDate = convertDate(change.endDate);
      
      if (!startDate) {
        console.log(`  ⚠️  Skipping ${change.name} - invalid start date: ${change.startDate}`);
        skippedMemberships++;
        continue;
      }

      try {
        // Find user by name
        const [firstName, ...lastNameParts] = change.name.split(' ');
        const lastName = lastNameParts.join(' ') || '';
        
        // Try exact match first
        let user = await client`SELECT * FROM users WHERE first_name = ${firstName} AND last_name = ${lastName}`;
        
        // If not found, try special case for "Sally Ann Kane"
        if (user.length === 0 && change.name === 'Sally Ann Kane') {
          user = await client`SELECT * FROM users WHERE first_name = 'Sally Ann' AND last_name = 'Kane'`;
        }
        
        if (user.length === 0) {
          console.log(`  ⚠️  Skipping ${change.name} - user not found`);
          skippedMemberships++;
          continue;
        }

        const userId = user[0].id;

        // Check if this membership already exists
        const existingMembership = await client`SELECT * FROM teams_users 
          WHERE user_id = ${userId} AND team_id = ${change.teamId} AND start_date = ${startDate}`;

        if (existingMembership.length > 0) {
          console.log(`  ⚠️  Skipping duplicate: ${change.name} → Team ${change.teamId} (${startDate})`);
          skippedMemberships++;
          continue;
        }

        // Insert the team membership
        await client`INSERT INTO teams_users (user_id, team_id, start_date, end_date) 
          VALUES (${userId}, ${change.teamId}, ${startDate}, ${endDate})`;

        console.log(`  ✅ Imported: ${change.name} → Team ${change.teamId} (${startDate} to ${endDate || 'active'})`);
        importedMemberships++;

      } catch (error) {
        console.log(`  ❌ Error importing ${change.name} → Team ${change.teamId}: ${error.message}`);
        skippedMemberships++;
      }
    }

    console.log(`\n=== Team Memberships Import Complete ===`);
    console.log(`✅ Successfully imported: ${importedMemberships} team memberships`);
    console.log(`⚠️  Skipped: ${skippedMemberships} records (duplicates or errors)`);
    console.log(`📊 Total processed: ${teamChanges.length} records`);

    // Final verification
    console.log(`\n=== Final Verification ===`);
    const totalUsers = await client`SELECT COUNT(*) as count FROM users`;
    const totalMemberships = await client`SELECT COUNT(*) as count FROM teams_users`;
    const totalTeams = await client`SELECT COUNT(*) as count FROM teams`;
    
    console.log(`Total users in database: ${totalUsers[0].count}`);
    console.log(`Total team memberships in database: ${totalMemberships[0].count}`);
    console.log(`Total teams in database: ${totalTeams[0].count}`);

    // Show some sample data
    const recentMemberships = await client`SELECT user_id, team_id, start_date, end_date 
      FROM teams_users ORDER BY start_date LIMIT 5`;

    console.log(`\nRecent team memberships:`);
    for (const membership of recentMemberships) {
      const user = await client`SELECT * FROM users WHERE id = ${membership.user_id}`;
      const team = await client`SELECT * FROM teams WHERE id = ${membership.team_id}`;
      if (user.length > 0 && team.length > 0) {
        console.log(`  ${user[0].first_name} ${user[0].last_name} → Team ${team[0].name} (${membership.start_date} to ${membership.end_date || 'active'})`);
      }
    }

    console.log(`\n🎉 Import completed successfully!`);
    console.log(`You can now view historical team composition in the admin dashboard.`);

  } catch (error) {
    console.error("Error importing data:", error);
  } finally {
    await client.end();
  }
}

importUsersAndTeams(); 