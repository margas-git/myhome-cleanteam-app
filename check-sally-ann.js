import { db } from "./server/db/connection.js";
import { users } from "./server/db/schema.js";

async function checkSallyAnn() {
  try {
    const allUsers = await db.select().from(users);
    
    console.log('All users in database:');
    allUsers.forEach(user => {
      console.log(`- ${user.firstName} ${user.lastName} (ID: ${user.id})`);
    });
    
    // Look for users with "Sally" or "Kane"
    const sallyUsers = allUsers.filter(user => 
      user.firstName.toLowerCase().includes('sally') || 
      user.lastName.toLowerCase().includes('kane')
    );
    
    console.log('\nUsers with "Sally" or "Kane":');
    sallyUsers.forEach(user => {
      console.log(`- ${user.firstName} ${user.lastName} (ID: ${user.id})`);
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit(0);
  }
}

checkSallyAnn(); 