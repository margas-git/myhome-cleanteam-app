import { Router } from "express";
import { db } from "../db/connection.js";
import { teams, customers, timeEntries, jobs, teamsUsers, users, settings, timeAllocationTiers } from "../db/schema.js";
import { eq, and, sql, inArray, or, lte, gte, isNull } from "drizzle-orm";
import { authMiddleware } from "../middleware/auth.js";
import { calculateCustomerMetrics } from "./admin.js";
import { getCurrentTeamMembers, getCurrentUserTeams } from "../utils/teamUtils.js";
const router = Router();
// Apply auth middleware to all routes
router.use(authMiddleware);
// Get user's teams
router.get("/teams", async (req, res) => {
    try {
        const userId = req.user.id;
        const userTeams = await db
            .select({
            id: teams.id,
            name: teams.name,
            color: teams.colorHex
        })
            .from(teams)
            .innerJoin(teamsUsers, eq(teams.id, teamsUsers.teamId))
            .where(eq(teamsUsers.userId, userId));
        res.json({ success: true, data: userTeams });
    }
    catch (error) {
        console.error("Error fetching teams:", error);
        res.status(500).json({ success: false, error: "Failed to fetch teams" });
    }
});
// Get team info (existing endpoint, keeping for compatibility)
router.get("/team", async (req, res) => {
    try {
        const userId = req.user.id;
        const userTeam = await db
            .select({
            id: teams.id,
            name: teams.name,
            color: teams.colorHex
        })
            .from(teams)
            .innerJoin(teamsUsers, eq(teams.id, teamsUsers.teamId))
            .where(eq(teamsUsers.userId, userId))
            .limit(1);
        if (userTeam.length === 0) {
            return res.status(404).json({ success: false, error: "No team found" });
        }
        res.json({ success: true, data: userTeam[0] });
    }
    catch (error) {
        console.error("Error fetching team:", error);
        res.status(500).json({ success: false, error: "Failed to fetch team" });
    }
});
// Get price tiers for staff
router.get("/price-tiers", async (req, res) => {
    try {
        const tiers = await db
            .select({
            id: timeAllocationTiers.id,
            priceMin: timeAllocationTiers.priceMin,
            priceMax: timeAllocationTiers.priceMax,
            allottedMinutes: timeAllocationTiers.allottedMinutes
        })
            .from(timeAllocationTiers)
            .orderBy(timeAllocationTiers.priceMin);
        res.json({
            success: true,
            data: tiers
        });
    }
    catch (error) {
        console.error("Error fetching price tiers:", error);
        res.status(500).json({ success: false, error: "Failed to fetch price tiers" });
    }
});
// Get active customers
router.get("/customers", async (req, res) => {
    try {
        // Get geolocation radius setting
        const radiusRow = await db
            .select()
            .from(settings)
            .where(eq(settings.key, "geolocation_radius_meters"))
            .limit(1);
        const radiusMeters = Number(radiusRow[0]?.value ?? 50000); // Default 50km
        const activeCustomers = await db
            .select({
            id: customers.id,
            name: customers.name,
            address: customers.address,
            latitude: customers.latitude,
            longitude: customers.longitude,
            phone: customers.phone,
            price: customers.price,
            isFriendsFamily: customers.isFriendsFamily,
            friendsFamilyMinutes: customers.friendsFamilyMinutes
        })
            .from(customers)
            .where(eq(customers.active, true));
        res.json({ success: true, data: activeCustomers, radiusMeters });
    }
    catch (error) {
        console.error("Error fetching customers:", error);
        res.status(500).json({ success: false, error: "Failed to fetch customers" });
    }
});
// Create new customer (staff only)
router.post("/customers", async (req, res) => {
    try {
        const userId = req.user.id;
        const { name, address, phone, email, notes, latitude, longitude } = req.body;
        // Validate required fields
        if (!name || !address || !latitude || !longitude) {
            return res.status(400).json({
                success: false,
                error: "Name, address, latitude, and longitude are required"
            });
        }
        // Create the customer
        const [newCustomer] = await db
            .insert(customers)
            .values({
            name: name.trim(),
            address: address.trim(),
            phone: phone?.trim() || null,
            email: email?.trim() || null,
            price: 0, // Default price for staff-created customers
            notes: notes?.trim() || null,
            cleanFrequency: "weekly", // Default frequency for staff-created customers
            latitude,
            longitude,
            createdByUserId: userId,
            active: true
        })
            .returning({
            id: customers.id,
            name: customers.name,
            address: customers.address,
            latitude: customers.latitude,
            longitude: customers.longitude,
            phone: customers.phone,
            price: customers.price
        });
        console.log(`[Customer Creation] Staff member ${userId} created customer: ${newCustomer.name}`);
        res.json({
            success: true,
            data: newCustomer,
            message: "Customer created successfully"
        });
    }
    catch (error) {
        console.error("Error creating customer:", error);
        res.status(500).json({ success: false, error: "Failed to create customer" });
    }
});
// Get active job for user
router.get("/active-job", async (req, res) => {
    try {
        const userId = req.user.id;
        const activeEntry = await db
            .select({
            id: timeEntries.id,
            jobId: timeEntries.jobId,
            clockInTime: timeEntries.clockInTime,
            customerName: customers.name,
            customerAddress: customers.address,
            customerPrice: customers.price,
            isFriendsFamily: customers.isFriendsFamily,
            friendsFamilyMinutes: customers.friendsFamilyMinutes,
            teamName: teams.name,
            teamColor: teams.colorHex
        })
            .from(timeEntries)
            .innerJoin(jobs, eq(timeEntries.jobId, jobs.id))
            .innerJoin(customers, eq(jobs.customerId, customers.id))
            .leftJoin(teams, eq(jobs.teamId, teams.id))
            .where(and(eq(timeEntries.userId, userId), sql `${timeEntries.clockOutTime} IS NULL`))
            .limit(1);
        if (activeEntry.length === 0) {
            return res.json({ success: true, data: null });
        }
        const job = activeEntry[0];
        const jobId = job.jobId;
        // Get all team members currently working on this job
        const members = await db
            .select({
            id: timeEntries.id,
            userId: timeEntries.userId,
            firstName: users.firstName,
            lastName: users.lastName,
            clockInTime: timeEntries.clockInTime
        })
            .from(timeEntries)
            .innerJoin(users, eq(timeEntries.userId, users.id))
            .where(and(eq(timeEntries.jobId, jobId), sql `${timeEntries.clockOutTime} IS NULL`));
        // Calculate time allocation based on customer settings
        let allottedMinutes = 90; // Default 90 minutes
        // Check for Friends & Family override first
        if (job.isFriendsFamily && job.friendsFamilyMinutes) {
            allottedMinutes = job.friendsFamilyMinutes;
        }
        else {
            // Get the expected time from price tiers based on customer price
            const priceTier = await db
                .select({
                allottedMinutes: timeAllocationTiers.allottedMinutes
            })
                .from(timeAllocationTiers)
                .where(and(sql `${timeAllocationTiers.priceMin} <= ${job.customerPrice}`, sql `${timeAllocationTiers.priceMax} >= ${job.customerPrice}`))
                .limit(1);
            if (priceTier.length > 0) {
                allottedMinutes = priceTier[0].allottedMinutes;
            }
        }
        // Adjust time based on team size (2 is the standard)
        const teamSize = members.length;
        if (teamSize === 1) {
            allottedMinutes = allottedMinutes * 2; // Solo: double the time
        }
        else if (teamSize > 2) {
            // For 3+ people, reduce the time proportionally
            // Example: 3 people = 2/3 of the time, 4 people = 1/2 of the time
            allottedMinutes = Math.round(allottedMinutes * (2 / teamSize));
        }
        // For 2 people, keep the standard time allocation (price tiers are designed for 2 people)
        // Format team members
        const formattedMembers = members.map(member => ({
            id: member.id,
            userId: member.userId,
            name: `${member.firstName} ${member.lastName}`,
            clockInTime: member.clockInTime
        }));
        const result = {
            ...job,
            allottedMinutes,
            teamSize,
            members: formattedMembers
        };
        res.json({ success: true, data: result });
    }
    catch (error) {
        console.error("Error fetching active job:", error);
        res.status(500).json({ success: false, error: "Failed to fetch active job" });
    }
});
// Get completed jobs for today
router.get("/completed-today", async (req, res) => {
    try {
        const userId = req.user.id;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const completedEntries = await db
            .select({
            id: timeEntries.id,
            jobId: timeEntries.jobId,
            clockInTime: timeEntries.clockInTime,
            clockOutTime: timeEntries.clockOutTime,
            customerName: customers.name,
            customerAddress: customers.address,
            lunchBreak: timeEntries.lunchBreak,
            autoLunchDeducted: timeEntries.autoLunchDeducted
        })
            .from(timeEntries)
            .innerJoin(jobs, eq(timeEntries.jobId, jobs.id))
            .innerJoin(customers, eq(jobs.customerId, customers.id))
            .where(and(eq(timeEntries.userId, userId), sql `${timeEntries.clockOutTime} IS NOT NULL`, sql `${timeEntries.clockInTime} >= ${today.toISOString()}`, sql `${timeEntries.clockInTime} < ${tomorrow.toISOString()}`))
            .orderBy(sql `${timeEntries.clockInTime} DESC`);
        res.json({ success: true, data: completedEntries });
    }
    catch (error) {
        console.error("Error fetching completed jobs:", error);
        res.status(500).json({ success: false, error: "Failed to fetch completed jobs" });
    }
});
// Clock in to a job
router.post("/time-entries/clock-in", async (req, res) => {
    try {
        const { customerId, teamId, memberIds } = req.body;
        const userId = req.user.id;
        console.log('🔍 Clock-in request received:', { customerId, teamId, memberIds, userId });
        if (!customerId || !teamId) {
            return res.status(400).json({
                success: false,
                error: "Customer ID and Team ID are required"
            });
        }
        // Check if user already has an active time entry
        const existingEntry = await db
            .select()
            .from(timeEntries)
            .where(and(eq(timeEntries.userId, userId), sql `${timeEntries.clockOutTime} IS NULL`))
            .limit(1);
        if (existingEntry.length > 0) {
            return res.status(400).json({
                success: false,
                error: "You already have an active time entry. Please clock out first."
            });
        }
        // Verify user belongs to the team
        const teamMembership = await db
            .select()
            .from(teamsUsers)
            .where(and(eq(teamsUsers.userId, userId), eq(teamsUsers.teamId, teamId)))
            .limit(1);
        if (teamMembership.length === 0) {
            return res.status(403).json({
                success: false,
                error: "You are not a member of this team"
            });
        }
        // Create a new job
        const [newJob] = await db
            .insert(jobs)
            .values({
            customerId,
            teamId,
            status: "in_progress"
        })
            .returning({ id: jobs.id, teamId: jobs.teamId });
        console.log(`[Clock-In] Created job:`, newJob);
        // Create time entries for all selected members
        const timeEntriesToCreate = [];
        const currentTime = new Date();
        // Always include the current user if they're not already in the memberIds
        const allMemberIds = memberIds && memberIds.length > 0
            ? [...new Set([...memberIds, userId])] // Remove duplicates
            : [userId];
        // Get staff member names for the staff column
        const staffMembers = await db
            .select({
            id: users.id,
            firstName: users.firstName,
            lastName: users.lastName
        })
            .from(users)
            .where(inArray(users.id, allMemberIds));
        const staffNameMap = new Map(staffMembers.map(staff => [staff.id, `${staff.firstName} ${staff.lastName}`]));
        for (const memberId of allMemberIds) {
            // Check if this member already has an active time entry
            const existingMemberEntry = await db
                .select()
                .from(timeEntries)
                .where(and(eq(timeEntries.userId, memberId), sql `${timeEntries.clockOutTime} IS NULL`))
                .limit(1);
            if (existingMemberEntry.length === 0) {
                timeEntriesToCreate.push({
                    userId: memberId,
                    jobId: newJob.id,
                    clockInTime: currentTime,
                    lunchBreak: false,
                    autoLunchDeducted: false,
                    staff: staffNameMap.get(memberId) || 'Unknown Staff'
                });
            }
        }
        // Insert all time entries
        const newEntries = await db
            .insert(timeEntries)
            .values(timeEntriesToCreate)
            .returning({ id: timeEntries.id, userId: timeEntries.userId });
        // Broadcast dashboard update for real-time admin dashboard
        try {
            const { broadcastDashboardUpdate } = await import('./admin');
            broadcastDashboardUpdate('staff_clocked_in', {
                jobId: newJob.id,
                customerId,
                teamId,
                memberCount: newEntries.length,
                timestamp: currentTime
            });
        }
        catch (error) {
            console.error('Failed to broadcast dashboard update:', error);
        }
        // Send SSE event to all connected staff
        try {
            broadcastSSEEvent({
                type: 'job_started',
                jobId: newJob.id,
                customerId,
                teamId,
                memberCount: newEntries.length,
                timestamp: currentTime
            });
        }
        catch (error) {
            console.error('Failed to send SSE event:', error);
        }
        res.json({
            success: true,
            data: {
                timeEntryIds: newEntries.map(entry => entry.id),
                jobId: newJob.id,
                message: `Clocked in ${newEntries.length} team member(s) successfully`
            }
        });
    }
    catch (error) {
        console.error("Error clocking in:", error);
        res.status(500).json({ success: false, error: "Failed to clock in" });
    }
});
// Get team members for a specific team
router.get("/teams/:teamId/members", async (req, res) => {
    try {
        const teamId = parseInt(req.params.teamId);
        const userId = req.user.id;
        // Verify user belongs to the team (check current membership)
        const userTeams = await getCurrentUserTeams(userId);
        const isUserInTeam = userTeams.some(team => team.teamId === teamId);
        if (!isUserInTeam) {
            return res.status(403).json({
                success: false,
                error: "You are not a current member of this team"
            });
        }
        // Get current team members (active as of today)
        const teamMembers = await getCurrentTeamMembers(teamId);
        // Format the response to match the expected structure
        const formattedMembers = teamMembers.map(member => ({
            id: member.userId,
            firstName: member.firstName,
            lastName: member.lastName,
            teamId: member.teamId
        }));
        res.json({ success: true, data: formattedMembers });
    }
    catch (error) {
        console.error("Error fetching team members:", error);
        res.status(500).json({ success: false, error: "Failed to fetch team members" });
    }
});
// Get current active clean information
router.get("/time-entries/current", async (req, res) => {
    try {
        const userId = req.user.id;
        // Find active time entry for the current user
        const activeEntry = await db
            .select({
            id: timeEntries.id,
            jobId: timeEntries.jobId,
            clockInTime: timeEntries.clockInTime
        })
            .from(timeEntries)
            .where(and(eq(timeEntries.userId, userId), sql `${timeEntries.clockOutTime} IS NULL`))
            .limit(1);
        if (activeEntry.length === 0) {
            return res.status(404).json({
                success: false,
                error: "No active time entry found"
            });
        }
        const jobId = activeEntry[0].jobId;
        // Get job and customer information
        const jobInfo = await db
            .select({
            customerName: customers.name,
            customerAddress: customers.address,
            teamName: teams.name,
            teamColor: teams.colorHex,
            clockInTime: sql `MIN(${timeEntries.clockInTime})`
        })
            .from(jobs)
            .innerJoin(customers, eq(jobs.customerId, customers.id))
            .leftJoin(teams, eq(jobs.teamId, teams.id))
            .innerJoin(timeEntries, eq(jobs.id, timeEntries.jobId))
            .where(eq(jobs.id, jobId))
            .groupBy(customers.name, customers.address, teams.name, teams.colorHex)
            .limit(1);
        if (jobInfo.length === 0) {
            return res.status(404).json({
                success: false,
                error: "Job information not found"
            });
        }
        // Get all team members currently working on this job
        const members = await db
            .select({
            id: timeEntries.id,
            userId: timeEntries.userId,
            firstName: users.firstName,
            lastName: users.lastName,
            clockInTime: timeEntries.clockInTime
        })
            .from(timeEntries)
            .innerJoin(users, eq(timeEntries.userId, users.id))
            .where(and(eq(timeEntries.jobId, jobId), sql `${timeEntries.clockOutTime} IS NULL`));
        const cleanInfo = {
            jobId,
            customerName: jobInfo[0].customerName,
            customerAddress: jobInfo[0].customerAddress,
            teamName: jobInfo[0].teamName,
            teamColor: jobInfo[0].teamColor,
            clockInTime: jobInfo[0].clockInTime,
            members: members.map(member => ({
                id: member.id,
                userId: member.userId,
                name: `${member.firstName} ${member.lastName}`,
                clockInTime: member.clockInTime
            }))
        };
        res.json({ success: true, data: cleanInfo });
    }
    catch (error) {
        console.error("Error fetching current clean info:", error);
        res.status(500).json({ success: false, error: "Failed to fetch current clean info" });
    }
});
// Get other team members (members from other teams)
router.get("/teams/other-members", async (req, res) => {
    try {
        const { teamId } = req.query;
        console.log("🔍 Other team members request - teamId:", teamId, "query:", req.query);
        if (!teamId) {
            console.log("❌ No teamId provided");
            return res.status(400).json({
                success: false,
                error: "Team ID is required"
            });
        }
        const selectedTeamId = parseInt(teamId);
        console.log("✅ Selected team ID:", selectedTeamId);
        // Get all active staff members who are not currently in the selected team
        const today = new Date().toISOString().split('T')[0];
        // First, get all active staff
        const allActiveStaff = await db
            .select({
            id: users.id,
            firstName: users.firstName,
            lastName: users.lastName
        })
            .from(users)
            .where(and(eq(users.role, "staff"), eq(users.active, true)));
        // Get current team members for the selected team
        const currentTeamMembers = await db
            .select({
            userId: teamsUsers.userId
        })
            .from(teamsUsers)
            .where(and(eq(teamsUsers.teamId, selectedTeamId), lte(teamsUsers.startDate, today), or(isNull(teamsUsers.endDate), gte(teamsUsers.endDate, today))));
        // Filter out current team members
        const currentTeamMemberIds = currentTeamMembers.map(m => m.userId);
        const otherTeamMembers = allActiveStaff.filter(staff => !currentTeamMemberIds.includes(staff.id));
        console.log("📋 Found other team members:", otherTeamMembers.length);
        res.json({ success: true, data: otherTeamMembers });
    }
    catch (error) {
        console.error("Error fetching other team members:", error);
        res.status(500).json({ success: false, error: "Failed to fetch other team members" });
    }
});
// Clock out from current job
router.post("/time-entries/clock-out", async (req, res) => {
    try {
        const { lunchBreak = false, clockOutAllMembers = true, selectedMemberIds = [] } = req.body;
        const userId = req.user.id;
        // Find active time entry for the current user
        const activeEntry = await db
            .select({
            id: timeEntries.id,
            jobId: timeEntries.jobId,
            clockInTime: timeEntries.clockInTime
        })
            .from(timeEntries)
            .where(and(eq(timeEntries.userId, userId), sql `${timeEntries.clockOutTime} IS NULL`))
            .limit(1);
        if (activeEntry.length === 0) {
            return res.status(400).json({
                success: false,
                error: "No active time entry found"
            });
        }
        const jobId = activeEntry[0].jobId;
        const clockInTime = activeEntry[0].clockInTime;
        const clockOutTime = new Date();
        if (!clockInTime) {
            return res.status(400).json({
                success: false,
                error: "Invalid clock in time"
            });
        }
        // Auto lunch deduction logic
        const clockInHour = clockInTime.getHours();
        const clockOutHour = clockOutTime.getHours();
        const shouldAutoDeductLunch = clockInHour < 12 && clockOutHour > 12 && !lunchBreak;
        let entriesToUpdate;
        if (clockOutAllMembers) {
            // Clock out all team members for this job
            entriesToUpdate = await db
                .select({
                id: timeEntries.id,
                userId: timeEntries.userId,
                clockInTime: timeEntries.clockInTime
            })
                .from(timeEntries)
                .where(and(eq(timeEntries.jobId, jobId), sql `${timeEntries.clockOutTime} IS NULL`));
        }
        else {
            // Clock out only selected members
            entriesToUpdate = await db
                .select({
                id: timeEntries.id,
                userId: timeEntries.userId,
                clockInTime: timeEntries.clockInTime
            })
                .from(timeEntries)
                .where(and(inArray(timeEntries.id, selectedMemberIds), sql `${timeEntries.clockOutTime} IS NULL`));
        }
        const updatedEntries = [];
        for (const entry of entriesToUpdate) {
            const entryClockInTime = entry.clockInTime;
            if (!entryClockInTime) {
                continue;
            }
            // Auto lunch deduction logic for each member
            const entryClockInHour = entryClockInTime.getHours();
            const entryClockOutHour = clockOutTime.getHours();
            const entryShouldAutoDeductLunch = entryClockInHour < 12 && entryClockOutHour > 12;
            const [updatedEntry] = await db
                .update(timeEntries)
                .set({
                clockOutTime: clockOutTime,
                lunchBreak: lunchBreak || entryShouldAutoDeductLunch,
                autoLunchDeducted: entryShouldAutoDeductLunch
            })
                .where(eq(timeEntries.id, entry.id))
                .returning();
            updatedEntries.push(updatedEntry);
        }
        // Check if the job is fully completed (all team members have clocked out)
        // If we clocked out all members, the job is definitely completed
        // For partial clock-outs, check if any active entries remain
        let isJobCompleted = clockOutAllMembers;
        if (!clockOutAllMembers) {
            const remainingActiveEntries = await db
                .select({ count: sql `COUNT(*)` })
                .from(timeEntries)
                .where(and(eq(timeEntries.jobId, jobId), sql `${timeEntries.clockOutTime} IS NULL`));
            isJobCompleted = remainingActiveEntries[0].count === 0;
        }
        if (isJobCompleted) {
            console.log(`Job ${jobId} is fully completed, calculating customer metrics...`);
            // Update the job status to 'completed'
            await db.update(jobs)
                .set({ status: 'completed' })
                .where(eq(jobs.id, jobId));
            // Get the customer ID for this job
            const jobInfo = await db
                .select({ customerId: jobs.customerId })
                .from(jobs)
                .where(eq(jobs.id, jobId))
                .limit(1);
            if (jobInfo.length > 0 && jobInfo[0].customerId) {
                const customerId = jobInfo[0].customerId;
                // Calculate metrics for this customer in the background (don't wait for it)
                calculateCustomerMetrics(customerId).catch(error => {
                    console.error(`Background metrics calculation failed for customer ${customerId}:`, error);
                });
            }
        }
        // Broadcast dashboard update for real-time admin dashboard
        try {
            const { broadcastDashboardUpdate } = await import('./admin');
            broadcastDashboardUpdate('staff_clocked_out', {
                jobId,
                clockedOutMembers: updatedEntries.length,
                isJobCompleted: isJobCompleted,
                timestamp: clockOutTime
            });
        }
        catch (error) {
            console.error('Failed to broadcast dashboard update:', error);
        }
        // Send SSE event to all connected staff
        try {
            broadcastSSEEvent({
                type: 'job_ended',
                jobId,
                clockedOutMembers: updatedEntries.length,
                isJobCompleted: isJobCompleted,
                timestamp: clockOutTime
            });
        }
        catch (error) {
            console.error('Failed to send SSE event:', error);
        }
        res.json({
            success: true,
            data: {
                message: `Ended clean for ${updatedEntries.length} team member(s) successfully`,
                lunchBreak: lunchBreak || shouldAutoDeductLunch,
                autoLunchDeducted: shouldAutoDeductLunch,
                clockedOutMembers: updatedEntries.length
            }
        });
    }
    catch (error) {
        console.error("Error clocking out:", error);
        res.status(500).json({ success: false, error: "Failed to clock out" });
    }
});
// === SERVER-SENT EVENTS ===
// Store active SSE connections
const sseConnections = new Map();
// SSE endpoint for staff events
router.get("/events", async (req, res) => {
    const userId = req.user.id;
    if (!userId) {
        res.status(401).json({ success: false, error: "Unauthorized" });
        return;
    }
    // Set SSE headers
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control'
    });
    // Send initial connection event
    res.write(`data: ${JSON.stringify({ type: 'connected', userId })}\n\n`);
    // Store connection
    sseConnections.set(userId, res);
    // Handle client disconnect
    req.on('close', () => {
        sseConnections.delete(userId);
        console.log(`SSE connection closed for user ${userId}`);
    });
    // Keep connection alive with heartbeat
    const heartbeat = setInterval(() => {
        if (!res.destroyed) {
            res.write(`data: ${JSON.stringify({ type: 'heartbeat' })}\n\n`);
        }
        else {
            clearInterval(heartbeat);
        }
    }, 30000); // Every 30 seconds
});
// Helper function to send events to specific users
export function sendSSEEvent(userId, event) {
    const connection = sseConnections.get(userId);
    if (connection && !connection.destroyed) {
        connection.write(`data: ${JSON.stringify(event)}\n\n`);
    }
}
// Helper function to send events to all connected users
export function broadcastSSEEvent(event) {
    console.log('📡 Broadcasting SSE event:', event.type, 'to', sseConnections.size, 'connections');
    sseConnections.forEach((connection, userId) => {
        if (!connection.destroyed) {
            connection.write(`data: ${JSON.stringify(event)}\n\n`);
            console.log('📤 Sent to user:', userId);
        }
        else {
            console.log('❌ Connection destroyed for user:', userId);
        }
    });
}
export default router;
