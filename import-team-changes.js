import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { db } from "./server/db/connection.js";
import { users, teams, teamsUsers } from "./server/db/schema.js";
import { eq, and, isNull } from "drizzle-orm";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function importTeamChanges() {
  try {
    console.log("=== Team Changes Import Script ===\n");

    // Read the CSV file
    const csvPath = path.join(__dirname, 'team-changes', 'team_id_tracker.csv');
    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    
    // Parse CSV
    const lines = csvContent.split('\n').filter(line => line.trim());
    const headers = lines[0].split(',');
    const data = lines.slice(1).filter(line => line.trim() && !line.startsWith(','));
    
    console.log(`Found ${data.length} team change records\n`);

    // Get current users and teams
    console.log("=== Current System Data ===");
    const currentUsers = await db.select().from(users);
    const currentTeams = await db.select().from(teams);
    
    console.log("Current Users:");
    currentUsers.forEach(user => {
      console.log(`  ID: ${user.id}, Name: ${user.firstName} ${user.lastName}, Email: ${user.email}`);
    });
    
    console.log("\nCurrent Teams:");
    currentTeams.forEach(team => {
      console.log(`  ID: ${team.id}, Name: ${team.name}, Active: ${team.active}`);
    });

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

    console.log(`\n=== Data Analysis ===`);
    console.log(`Total team changes: ${teamChanges.length}`);
    console.log(`Unique staff members: ${uniqueNames.size}`);
    console.log(`Unique teams: ${uniqueTeams.size}`);
    
    console.log("\nUnique Staff Names:");
    Array.from(uniqueNames).sort().forEach(name => {
      console.log(`  - ${name}`);
    });
    
    console.log("\nUnique Team IDs:");
    Array.from(uniqueTeams).sort().forEach(teamId => {
      console.log(`  - Team ID: ${teamId}`);
    });

    // Check for missing teams
    const missingTeams = Array.from(uniqueTeams).filter(teamId => 
      !currentTeams.find(team => team.id === teamId)
    );
    
    if (missingTeams.length > 0) {
      console.log(`\n⚠️  Missing Teams (need to be created):`);
      missingTeams.forEach(teamId => console.log(`  - Team ID: ${teamId}`));
    } else {
      console.log("\n✅ All teams exist in the system");
    }

    // Check for missing users
    const missingUsers = [];
    const existingUsers = [];
    
    for (const name of uniqueNames) {
      const existingUser = currentUsers.find(user => 
        `${user.firstName} ${user.lastName}`.toLowerCase() === name.toLowerCase()
      );
      
      if (existingUser) {
        existingUsers.push({ name, userId: existingUser.id });
      } else {
        missingUsers.push(name);
      }
    }
    
    console.log(`\n=== User Matching Results ===`);
    console.log(`Existing users (will be matched): ${existingUsers.length}`);
    existingUsers.forEach(({ name, userId }) => {
      console.log(`  - ${name} → User ID: ${userId}`);
    });
    
    console.log(`\nMissing users (will be created): ${missingUsers.length}`);
    missingUsers.forEach(name => {
      console.log(`  - ${name}`);
    });

    // Show sample of team changes
    console.log(`\n=== Sample Team Changes ===`);
    teamChanges.slice(0, 10).forEach((change, index) => {
      console.log(`${index + 1}. ${change.name} → Team ${change.teamId} (${change.startDate} to ${change.endDate}) [${change.status}]`);
    });
    
    if (teamChanges.length > 10) {
      console.log(`... and ${teamChanges.length - 10} more records`);
    }

    console.log(`\n=== Import Summary ===`);
    console.log(`✅ Ready to import ${teamChanges.length} team change records`);
    console.log(`✅ Will create ${missingUsers.length} new users`);
    console.log(`⚠️  Need to create ${missingTeams.length} teams`);
    console.log(`✅ Will match ${existingUsers.length} existing users`);
    
    console.log(`\n=== Next Steps ===`);
    console.log(`1. Create missing teams (if any)`);
    console.log(`2. Run the import script to process all data`);
    console.log(`3. Verify the results in the admin dashboard`);

  } catch (error) {
    console.error("Error analyzing team changes:", error);
  }
}

importTeamChanges(); 