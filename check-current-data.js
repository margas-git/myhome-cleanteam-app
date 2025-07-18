import { db } from "./server/db/connection.js";
import { users, teams } from "./server/db/schema.js";

async function checkCurrentData() {
  try {
    console.log("=== Current Users ===");
    const currentUsers = await db.select().from(users);
    currentUsers.forEach(user => {
      console.log(`ID: ${user.id}, Name: ${user.firstName} ${user.lastName}, Email: ${user.email}, Role: ${user.role}`);
    });

    console.log("\n=== Current Teams ===");
    const currentTeams = await db.select().from(teams);
    currentTeams.forEach(team => {
      console.log(`ID: ${team.id}, Name: ${team.name}, Color: ${team.colorHex}, Active: ${team.active}`);
    });

    console.log(`\nTotal Users: ${currentUsers.length}`);
    console.log(`Total Teams: ${currentTeams.length}`);
  } catch (error) {
    console.error("Error checking current data:", error);
  }
}

checkCurrentData(); 