import { db } from './server/db/connection.ts';
import { timeEntries, users } from './server/db/schema.ts';
import { eq, sql } from 'drizzle-orm';

async function checkTimeEntries() {
  try {
    console.log('Checking time entries...');
    
    // Get all time entries from the last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const entries = await db
      .select({
        id: timeEntries.id,
        userId: timeEntries.userId,
        jobId: timeEntries.jobId,
        clockInTime: timeEntries.clockInTime,
        clockOutTime: timeEntries.clockOutTime,
        firstName: users.firstName,
        lastName: users.lastName
      })
      .from(timeEntries)
      .innerJoin(users, eq(timeEntries.userId, users.id))
      .where(sql`${timeEntries.clockInTime} >= ${sevenDaysAgo.toISOString()}`);

    console.log(`Found ${entries.length} time entries in the last 7 days:`);
    
    entries.forEach(entry => {
      console.log(`- ID: ${entry.id}, User: ${entry.firstName} ${entry.lastName}, Clock In: ${entry.clockInTime}, Clock Out: ${entry.clockOutTime}`);
    });
    
    // Check today's entries specifically
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const todayEntries = await db
      .select({
        id: timeEntries.id,
        userId: timeEntries.userId,
        jobId: timeEntries.jobId,
        clockInTime: timeEntries.clockInTime,
        clockOutTime: timeEntries.clockOutTime,
        firstName: users.firstName,
        lastName: users.lastName
      })
      .from(timeEntries)
      .innerJoin(users, eq(timeEntries.userId, users.id))
      .where(sql`${timeEntries.clockInTime} >= ${today.toISOString()} AND ${timeEntries.clockInTime} < ${tomorrow.toISOString()}`);

    console.log(`\nFound ${todayEntries.length} time entries for today (${today.toISOString().split('T')[0]}):`);
    
    todayEntries.forEach(entry => {
      console.log(`- ID: ${entry.id}, User: ${entry.firstName} ${entry.lastName}, Clock In: ${entry.clockInTime}, Clock Out: ${entry.clockOutTime}`);
    });
    
  } catch (error) {
    console.error('Error checking time entries:', error);
  }
}

checkTimeEntries(); 