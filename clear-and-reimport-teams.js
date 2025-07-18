import { db } from "./server/db/connection.js";
import { teamsUsers, users } from "./server/db/schema.js";
import { eq } from "drizzle-orm";
import fs from 'fs';
import csv from 'csv-parser';
import { and, isNull, gte, lte, or } from "drizzle-orm";
import { sql } from "drizzle-orm";

// Helper function to convert date from DD/MM/YYYY to YYYY-MM-DD
function convertDate(dateStr) {
  if (!dateStr || dateStr.trim() === '') return null;
  
  const parts = dateStr.split('/');
  if (parts.length !== 3) return null;
  
  const day = parts[0].padStart(2, '0');
  const month = parts[1].padStart(2, '0');
  const year = parts[2];
  
  return `${year}-${month}-${day}`;
}

// Helper function to find user by name
async function findUserByName(firstName, lastName) {
  const allUsers = await db.select().from(users);
  
  // Try exact match first
  let user = allUsers.find(u => 
    u.firstName.toLowerCase() === firstName.toLowerCase() && 
    u.lastName.toLowerCase() === lastName.toLowerCase()
  );
  
  if (user) return user;
  
  // Try partial match on last name
  user = allUsers.find(u => 
    u.lastName.toLowerCase() === lastName.toLowerCase()
  );
  
  if (user) return user;
  
  // Special case for "Sally Ann Kane" - try different combinations
  if (firstName.toLowerCase() === 'sally' && lastName.toLowerCase() === 'ann kane') {
    user = allUsers.find(u => 
      u.firstName.toLowerCase() === 'sally ann' && 
      u.lastName.toLowerCase() === 'kane'
    );
    if (user) return user;
  }
  
  // Try matching by full name (for cases like "Sally Ann Kane")
  const fullName = `${firstName} ${lastName}`.toLowerCase();
  user = allUsers.find(u => 
    `${u.firstName} ${u.lastName}`.toLowerCase() === fullName
  );
  
  return user;
}

async function clearAndReimportTeams() {
  try {
    console.log('Clearing teams_users table...');
    
    // Delete all records from teams_users
    await db.delete(teamsUsers);
    console.log('✓ Cleared teams_users table');
    
    // Reset the sequence for the id column (if it exists)
    try {
      await db.execute(sql`ALTER SEQUENCE teams_users_id_seq RESTART WITH 1`);
      console.log('✓ Reset id sequence');
    } catch (error) {
      console.log('Note: Could not reset sequence (might not exist yet)');
    }
    
    console.log('\nReading team_id_tracker.csv...');
    
    const results = [];
    fs.createReadStream('team-changes/team_id_tracker.csv')
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', async () => {
        console.log(`✓ Read ${results.length} records from CSV`);
        
        console.log('\nImporting team memberships...');
        let imported = 0;
        let skipped = 0;
        
        for (const row of results) {
          try {
            // Skip empty rows
            if (!row.team_id || !row.name || row.team_id.trim() === '' || row.name.trim() === '') {
              skipped++;
              continue;
            }
            
            const teamId = parseInt(row.team_id);
            if (isNaN(teamId)) {
              console.error(`Invalid team_id: ${row.team_id}`);
              skipped++;
              continue;
            }
            
            // Parse name (assuming format is "FirstName LastName")
            const nameParts = row.name.trim().split(' ');
            if (nameParts.length < 2) {
              console.error(`Invalid name format: ${row.name}`);
              skipped++;
              continue;
            }
            
            const firstName = nameParts[0];
            const lastName = nameParts.slice(1).join(' '); // Handle multi-word last names
            
            // Find user by name
            const user = await findUserByName(firstName, lastName);
            if (!user) {
              console.error(`User not found: ${row.name}`);
              skipped++;
              continue;
            }
            
            // Convert dates
            const startDate = convertDate(row.start_date);
            const endDate = convertDate(row.end_date);
            
            if (!startDate) {
              console.error(`Invalid start_date: ${row.start_date}`);
              skipped++;
              continue;
            }
            
            // Insert the team membership
            await db.insert(teamsUsers).values({
              teamId: teamId,
              userId: user.id,
              startDate: startDate,
              endDate: endDate
            });
            
            imported++;
            if (imported % 10 === 0) {
              console.log(`  Imported ${imported} records...`);
            }
            
          } catch (error) {
            console.error(`Error importing row:`, row, error.message);
            skipped++;
          }
        }
        
        console.log(`\n✓ Import complete!`);
        console.log(`  - Imported: ${imported} records`);
        console.log(`  - Skipped: ${skipped} records`);
        
        // Verify the import
        const totalRecords = await db.select().from(teamsUsers);
        console.log(`  - Total in database: ${totalRecords.length} records`);
        
        // Check for current memberships
        const today = new Date().toISOString().split('T')[0];
        const currentMemberships = await db
          .select()
          .from(teamsUsers)
          .where(
            and(
              lte(teamsUsers.startDate, today),
              or(
                isNull(teamsUsers.endDate),
                gte(teamsUsers.endDate, today)
              )
            )
          );
        
        console.log(`  - Current memberships (${today}): ${currentMemberships.length} records`);
        
        if (currentMemberships.length === 0) {
          console.log('\n⚠️  No current memberships found!');
          console.log('   This means all memberships have end dates in the past.');
          console.log('   You may want to set some end_date values to NULL to make them current.');
        }
        process.exit(0);
      });
      
  } catch (error) {
    console.error('Error:', error);
  }
}

clearAndReimportTeams(); 