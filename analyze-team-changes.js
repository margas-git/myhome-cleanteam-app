import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function analyzeTeamChanges() {
  try {
    console.log("=== Team Changes Analysis ===\n");

    // Read the CSV file
    const csvPath = path.join(__dirname, 'team-changes', 'team_id_tracker.csv');
    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    
    // Parse CSV
    const lines = csvContent.split('\n').filter(line => line.trim());
    const headers = lines[0].split(',');
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

    console.log(`=== Data Analysis ===`);
    console.log(`Total team changes: ${teamChanges.length}`);
    console.log(`Unique staff members: ${uniqueNames.size}`);
    console.log(`Unique teams: ${uniqueTeams.size}`);
    
    console.log("\n=== Unique Staff Names ===");
    Array.from(uniqueNames).sort().forEach(name => {
      console.log(`  - ${name}`);
    });
    
    console.log("\n=== Unique Team IDs ===");
    Array.from(uniqueTeams).sort().forEach(teamId => {
      console.log(`  - Team ID: ${teamId}`);
    });

    // Analyze date formats
    console.log("\n=== Date Format Analysis ===");
    const sampleDates = teamChanges.slice(0, 5).map(t => ({ start: t.startDate, end: t.endDate }));
    sampleDates.forEach((dates, index) => {
      console.log(`  ${index + 1}. Start: ${dates.start}, End: ${dates.end}`);
    });

    // Show sample of team changes
    console.log("\n=== Sample Team Changes ===");
    teamChanges.slice(0, 15).forEach((change, index) => {
      console.log(`${index + 1}. ${change.name} → Team ${change.teamId} (${change.startDate} to ${change.endDate}) [${change.status}]`);
    });
    
    if (teamChanges.length > 15) {
      console.log(`... and ${teamChanges.length - 15} more records`);
    }

    // Analyze status distribution
    const statusCounts = {};
    teamChanges.forEach(change => {
      statusCounts[change.status] = (statusCounts[change.status] || 0) + 1;
    });
    
    console.log("\n=== Status Distribution ===");
    Object.entries(statusCounts).forEach(([status, count]) => {
      console.log(`  ${status}: ${count} records`);
    });

    console.log(`\n=== Import Summary ===`);
    console.log(`✅ Ready to import ${teamChanges.length} team change records`);
    console.log(`✅ Will need to create ${uniqueNames.size} users (or match existing ones)`);
    console.log(`⚠️  Need to ensure ${uniqueTeams.size} teams exist in system`);
    console.log(`✅ Date format: DD/MM/YYYY (will be converted to YYYY-MM-DD)`);
    
    console.log(`\n=== Next Steps ===`);
    console.log(`1. Check if teams 1, 2, 3 exist in the system`);
    console.log(`2. Match staff names to existing users or create new ones`);
    console.log(`3. Convert dates from DD/MM/YYYY to YYYY-MM-DD format`);
    console.log(`4. Import using temporal team membership logic`);

  } catch (error) {
    console.error("Error analyzing team changes:", error);
  }
}

analyzeTeamChanges(); 