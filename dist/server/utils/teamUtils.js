import { db } from "../db/connection.js";
import { teamsUsers, users, teams } from "../db/schema.js";
import { eq, and, lte, gte, isNull, or } from "drizzle-orm";
/**
 * Get all team members for a specific team at a given date
 */
export async function getTeamMembersAtDate(teamId, date) {
    const dateString = date.toISOString().split('T')[0]; // Convert to YYYY-MM-DD format
    const teamMembers = await db
        .select({
        userId: teamsUsers.userId,
        teamId: teamsUsers.teamId,
        startDate: teamsUsers.startDate,
        endDate: teamsUsers.endDate,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
        role: users.role
    })
        .from(teamsUsers)
        .innerJoin(users, eq(teamsUsers.userId, users.id))
        .where(and(eq(teamsUsers.teamId, teamId), lte(teamsUsers.startDate, dateString), or(isNull(teamsUsers.endDate), gte(teamsUsers.endDate, dateString))));
    return teamMembers;
}
/**
 * Get all teams a user was part of at a given date
 */
export async function getUserTeamsAtDate(userId, date) {
    const dateString = date.toISOString().split('T')[0]; // Convert to YYYY-MM-DD format
    const userTeams = await db
        .select({
        userId: teamsUsers.userId,
        teamId: teamsUsers.teamId,
        startDate: teamsUsers.startDate,
        endDate: teamsUsers.endDate,
        teamName: teams.name,
        teamColor: teams.colorHex
    })
        .from(teamsUsers)
        .innerJoin(teams, eq(teamsUsers.teamId, teams.id))
        .where(and(eq(teamsUsers.userId, userId), lte(teamsUsers.startDate, dateString), or(isNull(teamsUsers.endDate), gte(teamsUsers.endDate, dateString))));
    return userTeams;
}
/**
 * Get current team members (active as of today)
 */
export async function getCurrentTeamMembers(teamId) {
    return getTeamMembersAtDate(teamId, new Date());
}
/**
 * Get current user teams (active as of today)
 */
export async function getCurrentUserTeams(userId) {
    return getUserTeamsAtDate(userId, new Date());
}
/**
 * Add a user to a team
 */
export async function addUserToTeam(userId, teamId, startDate) {
    const startDateString = startDate ? startDate.toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
    // First, end any current membership in this team
    await db
        .update(teamsUsers)
        .set({ endDate: startDateString })
        .where(and(eq(teamsUsers.userId, userId), eq(teamsUsers.teamId, teamId), isNull(teamsUsers.endDate)));
    // Add new membership
    return db.insert(teamsUsers).values({
        userId,
        teamId,
        startDate: startDateString,
        endDate: null // Currently active
    });
}
/**
 * Remove a user from a team
 */
export async function removeUserFromTeam(userId, teamId, endDate) {
    const endDateString = endDate ? endDate.toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
    return db
        .update(teamsUsers)
        .set({ endDate: endDateString })
        .where(and(eq(teamsUsers.userId, userId), eq(teamsUsers.teamId, teamId), isNull(teamsUsers.endDate)));
}
