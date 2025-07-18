import { db } from "./server/db/connection.js";
import { teamsUsers, users, teams } from "./server/db/schema.js";
import { eq, and, lte, gte, isNull, or } from "drizzle-orm";

async function checkTeamMembers() {
  try {
    const today = new Date().toISOString().split('T')[0];
    console.log('Today:', today);
    
    // Check all team memberships
    const allMemberships = await db
      .select({
        userId: teamsUsers.userId,
        teamId: teamsUsers.teamId,
        startDate: teamsUsers.startDate,
        endDate: teamsUsers.endDate,
        firstName: users.firstName,
        lastName: users.lastName,
        teamName: teams.name
      })
      .from(teamsUsers)
      .innerJoin(users, eq(teamsUsers.userId, users.id))
      .innerJoin(teams, eq(teamsUsers.teamId, teams.id))
      .orderBy(teamsUsers.teamId, users.firstName);
    
    console.log('Total memberships:', allMemberships.length);
    allMemberships.forEach(m => {
      console.log(`${m.teamName} (${m.teamId}): ${m.firstName} ${m.lastName} (${m.userId}) - ${m.startDate} to ${m.endDate || 'active'}`);
    });
    
    // Check active memberships for today
    const activeMemberships = await db
      .select({
        userId: teamsUsers.userId,
        teamId: teamsUsers.teamId,
        startDate: teamsUsers.startDate,
        endDate: teamsUsers.endDate,
        firstName: users.firstName,
        lastName: users.lastName,
        teamName: teams.name
      })
      .from(teamsUsers)
      .innerJoin(users, eq(teamsUsers.userId, users.id))
      .innerJoin(teams, eq(teamsUsers.teamId, teams.id))
      .where(
        and(
          lte(teamsUsers.startDate, today),
          or(
            isNull(teamsUsers.endDate),
            gte(teamsUsers.endDate, today)
          )
        )
      )
      .orderBy(teamsUsers.teamId, users.firstName);
    
    console.log('\nActive memberships today:', activeMemberships.length);
    activeMemberships.forEach(m => {
      console.log(`${m.teamName} (${m.teamId}): ${m.firstName} ${m.lastName} (${m.userId}) - ${m.startDate} to ${m.endDate || 'active'}`);
    });
    
    // Check by team
    const allTeams = await db.select().from(teams);
    console.log('\nTeams:', allTeams.length);
    allTeams.forEach(team => {
      const teamMembers = activeMemberships.filter(m => m.teamId === team.id);
      console.log(`${team.name} (${team.id}): ${teamMembers.length} members`);
      teamMembers.forEach(m => {
        console.log(`  - ${m.firstName} ${m.lastName}`);
      });
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit(0);
  }
}

checkTeamMembers(); 