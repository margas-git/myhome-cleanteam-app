import { Router } from "express";
import { db } from "../db/connection.js";
import { users, teams, customers, timeEntries, jobs, teamsUsers, settings, lunchBreakOverrides, timeAllocationTiers } from "../db/schema.js";
import { eq, and, sql, inArray, lte, or, isNull, gte } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { addUserToTeam, removeUserFromTeam, getTeamMembersAtDate, getUserTeamsAtDate, getCurrentUserTeams } from "../utils/teamUtils.js";
const router = Router();
// Admin middleware - check if user has admin/manager role
const adminMiddleware = (req, res, next) => {
    if (!req.user || (req.user.role !== "admin" && req.user.role !== "manager")) {
        return res.status(403).json({ success: false, error: "Admin access required" });
    }
    next();
};
router.use(adminMiddleware);
// === CUSTOMER MANAGEMENT ===
// Get all customers
router.get("/customers", async (req, res) => {
    try {
        // Get all customers first (simple query for now)
        const allCustomers = await db
            .select()
            .from(customers)
            .orderBy(customers.name);
        // Get all completed jobs with metrics in a single query
        const completedJobsWithMetrics = await db
            .select({
            customerId: jobs.customerId,
            jobId: jobs.id,
            price: customers.price,
            isFriendsFamily: customers.isFriendsFamily,
            friendsFamilyMinutes: customers.friendsFamilyMinutes,
            actualJobDuration: sql `
          EXTRACT(EPOCH FROM (
            MAX(${timeEntries.clockOutTime}) - MIN(${timeEntries.clockInTime})
          )) / 3600
        `,
            totalWages: sql `
          COALESCE(
            SUM(
              EXTRACT(EPOCH FROM (${timeEntries.clockOutTime} - ${timeEntries.clockInTime})) / 3600 * 32.31
            ),
            0
          )
        `,
            allottedMinutes: timeAllocationTiers.allottedMinutes
        })
            .from(jobs)
            .innerJoin(customers, eq(jobs.customerId, customers.id))
            .innerJoin(timeEntries, eq(jobs.id, timeEntries.jobId))
            .leftJoin(timeAllocationTiers, and(sql `${timeAllocationTiers.priceMin} <= ${customers.price}`, sql `${timeAllocationTiers.priceMax} >= ${customers.price}`))
            .where(sql `${timeEntries.clockOutTime} IS NOT NULL`)
            .groupBy(jobs.id, jobs.customerId, customers.price, customers.isFriendsFamily, customers.friendsFamilyMinutes, timeAllocationTiers.allottedMinutes)
            .having(sql `COUNT(CASE WHEN ${timeEntries.clockOutTime} IS NULL THEN 1 END) = 0`);
        // Group completed jobs by customer
        const jobsByCustomer = completedJobsWithMetrics.reduce((acc, job) => {
            if (job.customerId && !acc[job.customerId]) {
                acc[job.customerId] = [];
            }
            if (job.customerId) {
                acc[job.customerId].push(job);
            }
            return acc;
        }, {});
        // Calculate metrics for each customer
        const customersWithMetrics = allCustomers.map(customer => {
            const customerJobs = jobsByCustomer[customer.id] || [];
            let averageEfficiency = 0;
            let totalWageRatio = 0;
            let validJobs = 0;
            for (const job of customerJobs) {
                if (job.actualJobDuration > 0) {
                    let expectedTime = 1.5; // Default 1.5 hours (90 minutes)
                    if (customer.isFriendsFamily && customer.friendsFamilyMinutes) {
                        expectedTime = customer.friendsFamilyMinutes / 60; // Use friends & family minutes
                    }
                    else if (job.allottedMinutes) {
                        expectedTime = job.allottedMinutes / 60; // Convert minutes to hours
                    }
                    // Calculate efficiency for this job
                    const jobEfficiency = (expectedTime / job.actualJobDuration) * 100;
                    averageEfficiency += Math.max(Math.round(jobEfficiency), 0);
                    // Calculate wage ratio for this job
                    const jobWageRatio = job.price > 0 ? Math.round((job.totalWages / job.price) * 100) : 0;
                    totalWageRatio += jobWageRatio;
                    validJobs++;
                }
            }
            const finalEfficiency = validJobs > 0 ? averageEfficiency / validJobs : 0;
            const finalWageRatio = validJobs > 0 ? totalWageRatio / validJobs : 0;
            return {
                ...customer,
                targetTimeMinutes: Math.round(finalEfficiency),
                averageWageRatio: Math.round(finalWageRatio)
            };
        });
        res.json({ success: true, data: customersWithMetrics });
    }
    catch (error) {
        console.error("Error fetching customers:", error);
        res.status(500).json({ success: false, error: "Failed to fetch customers" });
    }
});
// Create new customer
router.post("/customers", async (req, res) => {
    try {
        const { name, address, phone, email, notes, price, cleanFrequency, latitude, longitude, isFriendsFamily, friendsFamilyMinutes } = req.body;
        if (!name || !address) {
            return res.status(400).json({
                success: false,
                error: "Name and address are required"
            });
        }
        // Check for existing customer with same name and address
        const existingCustomer = await db
            .select()
            .from(customers)
            .where(and(eq(customers.name, name), eq(customers.address, address)))
            .limit(1);
        if (existingCustomer.length > 0) {
            const customer = existingCustomer[0];
            const status = customer.active ? "active" : "archived";
            return res.status(409).json({
                success: false,
                error: `Customer already exists with status: ${status}`,
                existingCustomer: {
                    id: customer.id,
                    name: customer.name,
                    address: customer.address,
                    active: customer.active
                }
            });
        }
        // Use provided coordinates or default to Melbourne
        const customerLatitude = latitude || "-37.8136";
        const customerLongitude = longitude || "144.9631";
        // Use provided price or default to 250
        const customerPrice = price ? parseInt(price) : 250;
        const [newCustomer] = await db
            .insert(customers)
            .values({
            name,
            address,
            latitude: customerLatitude,
            longitude: customerLongitude,
            phone: phone || null,
            email: email || null,
            notes: notes || null,
            price: customerPrice,
            cleanFrequency: cleanFrequency || "weekly",
            isFriendsFamily: isFriendsFamily || false,
            friendsFamilyMinutes: friendsFamilyMinutes ? parseInt(friendsFamilyMinutes) : null,
            active: true,
            createdAt: new Date()
        })
            .returning();
        res.json({ success: true, data: newCustomer });
    }
    catch (error) {
        console.error("Error creating customer:", error);
        res.status(500).json({ success: false, error: "Failed to create customer" });
    }
});
// Update customer
router.put("/customers/:id", async (req, res) => {
    try {
        const customerId = parseInt(req.params.id);
        const { name, address, latitude, longitude, phone, email, notes, price, cleanFrequency, active, isFriendsFamily, friendsFamilyMinutes } = req.body;
        // Build update object dynamically to only update provided fields
        const updateData = {};
        if (name !== undefined)
            updateData.name = name;
        if (address !== undefined)
            updateData.address = address;
        if (latitude !== undefined)
            updateData.latitude = latitude;
        if (longitude !== undefined)
            updateData.longitude = longitude;
        if (phone !== undefined)
            updateData.phone = phone;
        if (email !== undefined)
            updateData.email = email;
        if (notes !== undefined)
            updateData.notes = notes;
        if (price !== undefined)
            updateData.price = parseInt(price);
        if (cleanFrequency !== undefined)
            updateData.cleanFrequency = cleanFrequency;
        if (active !== undefined)
            updateData.active = active;
        if (isFriendsFamily !== undefined)
            updateData.isFriendsFamily = isFriendsFamily;
        if (friendsFamilyMinutes !== undefined)
            updateData.friendsFamilyMinutes = friendsFamilyMinutes ? parseInt(friendsFamilyMinutes) : null;
        const [updatedCustomer] = await db
            .update(customers)
            .set(updateData)
            .where(eq(customers.id, customerId))
            .returning();
        if (!updatedCustomer) {
            return res.status(404).json({ success: false, error: "Customer not found" });
        }
        res.json({ success: true, data: updatedCustomer });
    }
    catch (error) {
        console.error("Error updating customer:", error);
        res.status(500).json({ success: false, error: "Failed to update customer" });
    }
});
// === STAFF MANAGEMENT ===
// Get all staff with their current status and team information
router.get("/staff", async (req, res) => {
    try {
        const allStaff = await db
            .select({
            id: users.id,
            email: users.email,
            firstName: users.firstName,
            lastName: users.lastName,
            phone: users.phone,
            role: users.role,
            active: users.active,
            createdAt: users.createdAt
        })
            .from(users)
            .orderBy(users.firstName, users.lastName);
        // Get current team assignments for each staff member (using temporal fields)
        const today = new Date().toISOString().split('T')[0];
        const teamAssignments = await db
            .select({
            userId: teamsUsers.userId,
            teamId: teamsUsers.teamId,
            teamName: teams.name,
            teamColor: teams.colorHex
        })
            .from(teamsUsers)
            .innerJoin(teams, eq(teamsUsers.teamId, teams.id))
            .where(and(eq(teams.active, true), lte(teamsUsers.startDate, today), or(isNull(teamsUsers.endDate), gte(teamsUsers.endDate, today))));
        // Get active time entries for each staff member
        const activeEntries = await db
            .select({
            userId: timeEntries.userId,
            jobId: timeEntries.jobId,
            clockInTime: timeEntries.clockInTime,
            customerName: customers.name,
            customerAddress: customers.address
        })
            .from(timeEntries)
            .innerJoin(jobs, eq(timeEntries.jobId, jobs.id))
            .innerJoin(customers, eq(jobs.customerId, customers.id))
            .where(sql `${timeEntries.clockOutTime} IS NULL`);
        // Combine staff data with active status and team information
        const staffWithStatus = allStaff.map(staff => {
            const activeEntry = activeEntries.find(entry => entry.userId === staff.id);
            const teamAssignment = teamAssignments.find(assignment => assignment.userId === staff.id);
            return {
                ...staff,
                activeJob: activeEntry || null,
                team: teamAssignment || null
            };
        });
        res.json({ success: true, data: staffWithStatus });
    }
    catch (error) {
        console.error("Error fetching staff:", error);
        res.status(500).json({ success: false, error: "Failed to fetch staff" });
    }
});
// Update staff member
router.put("/staff/:id", async (req, res) => {
    try {
        const staffId = parseInt(req.params.id);
        const { email, firstName, lastName, phone, role, active } = req.body;
        // Only require fields if we're doing a full update (not just archive)
        if (active === undefined && (!email || !firstName || !lastName)) {
            return res.status(400).json({
                success: false,
                error: "Email, first name, and last name are required"
            });
        }
        // Check if email already exists for a different user
        const existingUser = await db
            .select()
            .from(users)
            .where(eq(users.email, email))
            .limit(1);
        if (existingUser.length > 0 && existingUser[0].id !== staffId) {
            return res.status(400).json({
                success: false,
                error: "Email already exists"
            });
        }
        // Build update object dynamically to only update provided fields
        const updateData = {};
        if (email !== undefined)
            updateData.email = email;
        if (firstName !== undefined)
            updateData.firstName = firstName;
        if (lastName !== undefined)
            updateData.lastName = lastName;
        if (phone !== undefined)
            updateData.phone = phone || null;
        if (role !== undefined)
            updateData.role = role;
        if (active !== undefined)
            updateData.active = active;
        const [updatedUser] = await db
            .update(users)
            .set(updateData)
            .where(eq(users.id, staffId))
            .returning({
            id: users.id,
            email: users.email,
            firstName: users.firstName,
            lastName: users.lastName,
            phone: users.phone,
            role: users.role,
            active: users.active,
            createdAt: users.createdAt
        });
        if (!updatedUser) {
            return res.status(404).json({ success: false, error: "Staff member not found" });
        }
        res.json({ success: true, data: updatedUser });
    }
    catch (error) {
        console.error("Error updating staff:", error);
        res.status(500).json({ success: false, error: "Failed to update staff" });
    }
});
// Create new staff member
router.post("/staff", async (req, res) => {
    try {
        const { email, password, firstName, lastName, phone, role = "staff" } = req.body;
        if (!email || !password || !firstName || !lastName) {
            return res.status(400).json({
                success: false,
                error: "Email, password, first name, and last name are required"
            });
        }
        // Check if email already exists
        const existingUser = await db
            .select()
            .from(users)
            .where(eq(users.email, email))
            .limit(1);
        if (existingUser.length > 0) {
            return res.status(400).json({
                success: false,
                error: "Email already exists"
            });
        }
        const passwordHash = await bcrypt.hash(password, 10);
        const [newUser] = await db
            .insert(users)
            .values({
            email,
            passwordHash,
            firstName,
            lastName,
            phone,
            role,
            active: true,
            createdAt: new Date()
        })
            .returning({
            id: users.id,
            email: users.email,
            firstName: users.firstName,
            lastName: users.lastName,
            phone: users.phone,
            role: users.role,
            active: users.active,
            createdAt: users.createdAt
        });
        res.json({ success: true, data: newUser });
    }
    catch (error) {
        console.error("Error creating staff:", error);
        res.status(500).json({ success: false, error: "Failed to create staff" });
    }
});
// === TEAM MANAGEMENT ===
// Get all teams with member count
router.get("/teams", async (req, res) => {
    try {
        // Get the date parameter, default to today
        const targetDate = req.query.date || new Date().toISOString().split('T')[0];
        const allTeams = await db
            .select({
            id: teams.id,
            name: teams.name,
            colorHex: teams.colorHex,
            active: teams.active,
            createdAt: teams.createdAt,
            memberCount: sql `COUNT(${teamsUsers.userId})`
        })
            .from(teams)
            .leftJoin(teamsUsers, eq(teams.id, teamsUsers.teamId))
            .groupBy(teams.id, teams.name, teams.colorHex, teams.active, teams.createdAt)
            .orderBy(teams.name);
        // Get active jobs for teams
        const activeJobs = await db
            .select({
            teamId: jobs.teamId,
            jobId: jobs.id,
            customerName: customers.name,
            customerAddress: customers.address
        })
            .from(jobs)
            .innerJoin(customers, eq(jobs.customerId, customers.id))
            .innerJoin(timeEntries, eq(jobs.id, timeEntries.jobId))
            .where(sql `${timeEntries.clockOutTime} IS NULL`);
        // Get current members for all teams (using temporal fields) for the target date
        const allTeamMembers = await db
            .select({
            teamId: teamsUsers.teamId,
            id: users.id,
            email: users.email,
            firstName: users.firstName,
            lastName: users.lastName,
            role: users.role
        })
            .from(users)
            .innerJoin(teamsUsers, eq(users.id, teamsUsers.userId))
            .where(and(lte(teamsUsers.startDate, targetDate), or(isNull(teamsUsers.endDate), gte(teamsUsers.endDate, targetDate))))
            .orderBy(teamsUsers.teamId, users.firstName, users.lastName);
        // Fetch staff pay rate from settings
        const payRateRow = await db
            .select()
            .from(settings)
            .where(eq(settings.key, "staff_pay_rate_per_hour"))
            .limit(1);
        const staffPayRatePerHour = Number(payRateRow[0]?.value ?? 32.31);
        // Get all completed jobs with team data in a single query for better performance
        const allCompletedJobs = await db
            .select({
            teamId: jobs.teamId,
            jobId: jobs.id,
            price: customers.price,
            isFriendsFamily: customers.isFriendsFamily,
            friendsFamilyMinutes: customers.friendsFamilyMinutes,
            actualJobDuration: sql `
          EXTRACT(EPOCH FROM (
            MAX(${timeEntries.clockOutTime}) - MIN(${timeEntries.clockInTime})
          )) / 3600
        `,
            totalWages: sql `
          COALESCE(
            SUM(
              EXTRACT(EPOCH FROM (${timeEntries.clockOutTime} - ${timeEntries.clockInTime})) / 3600 * ${staffPayRatePerHour}
            ),
            0
          )
        `
        })
            .from(jobs)
            .innerJoin(customers, eq(jobs.customerId, customers.id))
            .innerJoin(timeEntries, eq(jobs.id, timeEntries.jobId))
            .where(and(sql `${timeEntries.clockOutTime} IS NOT NULL`))
            .groupBy(jobs.id, jobs.teamId, customers.price, customers.isFriendsFamily, customers.friendsFamilyMinutes)
            .having(sql `COUNT(CASE WHEN ${timeEntries.clockOutTime} IS NULL THEN 1 END) = 0`);
        // Get price tiers once for all calculations
        const priceTiers = await db
            .select({
            priceMin: timeAllocationTiers.priceMin,
            priceMax: timeAllocationTiers.priceMax,
            allottedMinutes: timeAllocationTiers.allottedMinutes
        })
            .from(timeAllocationTiers)
            .orderBy(timeAllocationTiers.priceMin);
        // Calculate metrics for each team using the pre-fetched data
        const teamsWithMetrics = allTeams.map((team) => {
            const teamJobs = allCompletedJobs.filter(job => job.teamId === team.id);
            const activeJob = activeJobs.find(job => job.teamId === team.id);
            const members = allTeamMembers.filter(member => member.teamId === team.id);
            let totalEfficiency = 0;
            let totalWageRatio = 0;
            let totalRevenue = 0;
            let totalWages = 0;
            let validJobs = 0;
            for (const job of teamJobs) {
                if (job.actualJobDuration > 0) {
                    let expectedTime = 1.5; // Default 1.5 hours (90 minutes)
                    if (job.isFriendsFamily && job.friendsFamilyMinutes) {
                        expectedTime = job.friendsFamilyMinutes / 60; // Use friends & family minutes
                    }
                    else {
                        // Find the appropriate price tier
                        const priceTier = priceTiers.find(tier => job.price >= Number(tier.priceMin) && job.price <= Number(tier.priceMax));
                        if (priceTier) {
                            expectedTime = priceTier.allottedMinutes / 60; // Convert minutes to hours
                        }
                    }
                    // Calculate efficiency for this job
                    const jobEfficiency = (expectedTime / job.actualJobDuration) * 100;
                    totalEfficiency += Math.max(Math.round(jobEfficiency), 0);
                    // Calculate wage ratio for this job (only for non-Friends & Family)
                    if (!job.isFriendsFamily) {
                        const jobWageRatio = job.price > 0 ? Math.round((job.totalWages / job.price) * 100) : 0;
                        totalWageRatio += jobWageRatio;
                        totalRevenue += job.price;
                        totalWages += job.totalWages;
                    }
                    validJobs++;
                }
            }
            const averageEfficiency = validJobs > 0 ? totalEfficiency / validJobs : 0;
            const averageWageRatio = validJobs > 0 ? totalWageRatio / validJobs : 0;
            return {
                ...team,
                activeJob: activeJob || null,
                members,
                averageEfficiency: Math.round(averageEfficiency),
                averageWageRatio: Math.round(averageWageRatio),
                totalRevenue: Math.round(totalRevenue),
                totalWages: Math.round(totalWages),
                completedJobsCount: validJobs
            };
        });
        res.json({ success: true, data: teamsWithMetrics });
    }
    catch (error) {
        console.error("Error fetching teams:", error);
        res.status(500).json({ success: false, error: "Failed to fetch teams" });
    }
});
// Update team
router.put("/teams/:id", async (req, res) => {
    try {
        const teamId = parseInt(req.params.id);
        const { name, colorHex } = req.body;
        // Only require fields if we're doing a full update (not just archive)
        if (req.body.active === undefined && (!name || !colorHex)) {
            return res.status(400).json({
                success: false,
                error: "Team name and color are required"
            });
        }
        const updateData = {};
        if (name !== undefined)
            updateData.name = name;
        if (colorHex !== undefined)
            updateData.colorHex = colorHex;
        if (req.body.active !== undefined)
            updateData.active = req.body.active;
        const [updatedTeam] = await db
            .update(teams)
            .set(updateData)
            .where(eq(teams.id, teamId))
            .returning();
        if (!updatedTeam) {
            return res.status(404).json({ success: false, error: "Team not found" });
        }
        res.json({ success: true, data: updatedTeam });
    }
    catch (error) {
        console.error("Error updating team:", error);
        res.status(500).json({ success: false, error: "Failed to update team" });
    }
});
// Create new team
router.post("/teams", async (req, res) => {
    try {
        const { name, colorHex } = req.body;
        if (!name || !colorHex) {
            return res.status(400).json({
                success: false,
                error: "Team name and color are required"
            });
        }
        const [newTeam] = await db
            .insert(teams)
            .values({
            name,
            colorHex,
            active: true,
            createdAt: new Date()
        })
            .returning();
        res.json({ success: true, data: newTeam });
    }
    catch (error) {
        console.error("Error creating team:", error);
        res.status(500).json({ success: false, error: "Failed to create team" });
    }
});
// Get team details with members
router.get("/teams/:id", async (req, res) => {
    try {
        const teamId = parseInt(req.params.id);
        const team = await db
            .select()
            .from(teams)
            .where(eq(teams.id, teamId))
            .limit(1);
        if (team.length === 0) {
            return res.status(404).json({ success: false, error: "Team not found" });
        }
        const members = await db
            .select({
            id: users.id,
            email: users.email,
            firstName: users.firstName,
            lastName: users.lastName,
            role: users.role
        })
            .from(users)
            .innerJoin(teamsUsers, eq(users.id, teamsUsers.userId))
            .where(eq(teamsUsers.teamId, teamId));
        // Get active job for this team
        const activeJob = await db
            .select({
            jobId: jobs.id,
            customerName: customers.name,
            customerAddress: customers.address
        })
            .from(jobs)
            .innerJoin(customers, eq(jobs.customerId, customers.id))
            .innerJoin(timeEntries, eq(jobs.id, timeEntries.jobId))
            .where(and(eq(jobs.teamId, teamId), sql `${timeEntries.clockOutTime} IS NULL`))
            .limit(1);
        res.json({
            success: true,
            data: {
                ...team[0],
                members,
                activeJob: activeJob[0] || null
            }
        });
    }
    catch (error) {
        console.error("Error fetching team:", error);
        res.status(500).json({ success: false, error: "Failed to fetch team" });
    }
});
// Add staff to team (TEMPORAL VERSION)
router.post("/teams/:id/members", async (req, res) => {
    try {
        const teamId = parseInt(req.params.id);
        const { userId, startDate } = req.body;
        if (!userId) {
            return res.status(400).json({
                success: false,
                error: "User ID is required"
            });
        }
        // Use the temporal utility function
        const startDateObj = startDate ? new Date(startDate) : new Date();
        await addUserToTeam(userId, teamId, startDateObj);
        res.json({
            success: true,
            data: {
                message: "User added to team successfully",
                startDate: startDateObj.toISOString().split('T')[0]
            }
        });
    }
    catch (error) {
        console.error("Error adding user to team:", error);
        res.status(500).json({ success: false, error: "Failed to add user to team" });
    }
});
// Remove staff from team (TEMPORAL VERSION)
router.delete("/teams/:id/members/:userId", async (req, res) => {
    try {
        const teamId = parseInt(req.params.id);
        const userId = parseInt(req.params.userId);
        const { endDate } = req.body; // Optional end date
        // Use the temporal utility function
        const endDateObj = endDate ? new Date(endDate) : new Date();
        await removeUserFromTeam(userId, teamId, endDateObj);
        res.json({
            success: true,
            data: {
                message: "User removed from team successfully",
                endDate: endDateObj.toISOString().split('T')[0]
            }
        });
    }
    catch (error) {
        console.error("Error removing user from team:", error);
        res.status(500).json({ success: false, error: "Failed to remove user from team" });
    }
});
// Get team members at a specific date
router.get("/teams/:id/members/:date", async (req, res) => {
    try {
        const teamId = parseInt(req.params.id);
        const date = new Date(req.params.date);
        const members = await getTeamMembersAtDate(teamId, date);
        res.json({
            success: true,
            data: {
                teamId,
                date: req.params.date,
                members
            }
        });
    }
    catch (error) {
        console.error("Error fetching team members:", error);
        res.status(500).json({ success: false, error: "Failed to fetch team members" });
    }
});
// Get user's team history
router.get("/users/:userId/teams", async (req, res) => {
    try {
        const userId = parseInt(req.params.userId);
        const { date } = req.query;
        let userTeams;
        if (date) {
            // Get teams at specific date
            userTeams = await getUserTeamsAtDate(userId, new Date(date));
        }
        else {
            // Get current teams
            userTeams = await getCurrentUserTeams(userId);
        }
        res.json({
            success: true,
            data: {
                userId,
                date: date || 'current',
                teams: userTeams
            }
        });
    }
    catch (error) {
        console.error("Error fetching user teams:", error);
        res.status(500).json({ success: false, error: "Failed to fetch user teams" });
    }
});
// === DASHBOARD DATA ===
// Get completed cleans
router.get("/cleans/completed", async (req, res) => {
    try {
        const dateFilter = req.query.dateFilter || 'today';
        const customStart = req.query.customStart;
        const customEnd = req.query.customEnd;
        // Get date range based on filter
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const dayOfWeek = today.getDay();
        let startDate, endDate;
        switch (dateFilter) {
            case 'yesterday':
                startDate = new Date(today.getTime() - 24 * 60 * 60 * 1000);
                endDate = today;
                break;
            case 'thisWeek':
                // Get Monday of current week (assuming Monday is start of work week)
                const monday = new Date(today.getTime() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1) * 24 * 60 * 60 * 1000);
                const friday = new Date(monday.getTime() + 5 * 24 * 60 * 60 * 1000);
                startDate = monday;
                endDate = new Date(friday.getTime() + 24 * 60 * 60 * 1000);
                break;
            case 'lastWeek':
                // Get Monday of last week
                const lastWeekMonday = new Date(today.getTime() - (dayOfWeek === 0 ? 13 : dayOfWeek + 6) * 24 * 60 * 60 * 1000);
                const lastWeekFriday = new Date(lastWeekMonday.getTime() + 5 * 24 * 60 * 60 * 1000);
                startDate = lastWeekMonday;
                endDate = new Date(lastWeekFriday.getTime() + 24 * 60 * 60 * 1000);
                break;
            case 'custom':
                if (customStart && customEnd) {
                    startDate = new Date(customStart);
                    endDate = new Date(customEnd);
                    endDate.setDate(endDate.getDate() + 1); // Include the end date
                }
                else {
                    startDate = today;
                    endDate = new Date(today.getTime() + 24 * 60 * 60 * 1000);
                }
                break;
            default: // today
                startDate = today;
                endDate = new Date(today.getTime() + 24 * 60 * 60 * 1000);
                break;
        }
        // Convert local time boundaries to UTC for database queries
        const startUTC = new Date(startDate.getTime() - startDate.getTimezoneOffset() * 60000);
        const endUTC = new Date(endDate.getTime() - endDate.getTimezoneOffset() * 60000);
        // Get completed jobs for the specified date range (jobs where ALL time entries have clockOutTime)
        const completedJobs = await db
            .select({
            jobId: jobs.id,
            customerName: customers.name,
            customerAddress: customers.address,
            customerLatitude: customers.latitude,
            customerLongitude: customers.longitude,
            teamName: teams.name,
            teamColor: teams.colorHex,
            price: customers.price,
            isFriendsFamily: customers.isFriendsFamily,
            friendsFamilyMinutes: customers.friendsFamilyMinutes,
            clockInTime: sql `MIN(${timeEntries.clockInTime})`,
            clockOutTime: sql `MAX(${timeEntries.clockOutTime})`,
            teamMembersAtCreation: jobs.teamMembersAtCreation,
            additionalStaff: jobs.additionalStaff
        })
            .from(jobs)
            .innerJoin(customers, eq(jobs.customerId, customers.id))
            .leftJoin(teams, eq(jobs.teamId, teams.id))
            .innerJoin(timeEntries, eq(jobs.id, timeEntries.jobId))
            .where(and(sql `${timeEntries.clockOutTime} IS NOT NULL`, sql `${timeEntries.clockOutTime} >= ${startUTC.toISOString()}`, sql `${timeEntries.clockOutTime} < ${endUTC.toISOString()}`))
            .groupBy(jobs.id, customers.name, customers.address, customers.latitude, customers.longitude, teams.name, teams.colorHex, customers.price, customers.isFriendsFamily, customers.friendsFamilyMinutes, jobs.teamMembersAtCreation, jobs.additionalStaff)
            .having(sql `COUNT(CASE WHEN ${timeEntries.clockOutTime} IS NULL THEN 1 END) = 0`)
            .orderBy(sql `MAX(${timeEntries.clockOutTime}) DESC`);
        // Fetch staff pay rate from settings
        const payRateRow = await db
            .select()
            .from(settings)
            .where(eq(settings.key, "staff_pay_rate_per_hour"))
            .limit(1);
        const staffPayRatePerHour = Number(payRateRow[0]?.value ?? 32.31);
        // For each job, get all team members who worked on it and calculate efficiency
        const completedCleansWithMembers = await Promise.all(completedJobs.map(async (job, idx) => {
            // Parse the team members from the new fields
            const coreTeamMembers = parseMaybeJson(job.teamMembersAtCreation);
            const additionalStaffMembers = parseMaybeJson(job.additionalStaff);
            // Get all time entries for this job to calculate efficiency
            const timeEntriesForJob = await db
                .select({
                id: timeEntries.id,
                userId: timeEntries.userId,
                firstName: users.firstName,
                lastName: users.lastName,
                clockInTime: timeEntries.clockInTime,
                clockOutTime: timeEntries.clockOutTime
            })
                .from(timeEntries)
                .innerJoin(users, eq(timeEntries.userId, users.id))
                .where(eq(timeEntries.jobId, job.jobId));
            // Calculate efficiency and wage ratio for this job
            let efficiency = 100; // Default to 100%
            let allocatedMinutes = 90; // Default 90 minutes
            let timeDifferenceMinutes = 0; // Default 0 minutes difference
            let wageRatio = 0;
            if (job.isFriendsFamily) {
                wageRatio = 0; // Always hide wage ratio for Friends & Family
            }
            else if (timeEntriesForJob.length > 0) {
                // Calculate actual time as job duration (not sum of individual hours)
                const clockInTimes = timeEntriesForJob
                    .map(m => m.clockInTime ? new Date(m.clockInTime).getTime() : null)
                    .filter(t => t !== null);
                const clockOutTimes = timeEntriesForJob
                    .map(m => m.clockOutTime ? new Date(m.clockOutTime).getTime() : null)
                    .filter(t => t !== null);
                if (clockInTimes.length > 0 && clockOutTimes.length > 0) {
                    const earliestStart = Math.min(...clockInTimes);
                    const latestEnd = Math.max(...clockOutTimes);
                    const actualJobDuration = (latestEnd - earliestStart) / (1000 * 60 * 60);
                    // Calculate expected time based on price tiers
                    let expectedTime = 1.5; // Default 1.5 hours (90 minutes)
                    if (job.isFriendsFamily && job.friendsFamilyMinutes) {
                        expectedTime = job.friendsFamilyMinutes / 60; // Use friends & family minutes
                    }
                    else {
                        // Get the expected time from price tiers based on customer price
                        const priceTier = await db
                            .select({
                            allottedMinutes: timeAllocationTiers.allottedMinutes
                        })
                            .from(timeAllocationTiers)
                            .where(and(sql `${timeAllocationTiers.priceMin} <= ${job.price}`, sql `${timeAllocationTiers.priceMax} >= ${job.price}`))
                            .limit(1);
                        if (priceTier.length > 0) {
                            expectedTime = priceTier[0].allottedMinutes / 60; // Convert minutes to hours
                        }
                    }
                    // Calculate efficiency for this job
                    efficiency = Math.max(Math.round((expectedTime / actualJobDuration) * 100), 0);
                    allocatedMinutes = Math.round(expectedTime * 60);
                    timeDifferenceMinutes = Math.round((actualJobDuration - expectedTime) * 60);
                    // Only clamp to 0, allow >100%
                    // Calculate wage ratio for this job (only for non-Friends & Family)
                    if (!job.isFriendsFamily) {
                        const totalWages = timeEntriesForJob.reduce((sum, member) => {
                            if (member.clockInTime && member.clockOutTime) {
                                const duration = (new Date(member.clockOutTime).getTime() - new Date(member.clockInTime).getTime()) / (1000 * 60 * 60);
                                return sum + (duration * staffPayRatePerHour);
                            }
                            return sum;
                        }, 0);
                        wageRatio = job.price > 0 ? Math.round((totalWages / job.price) * 100) : 0;
                    }
                }
            }
            // Map string arrays to objects with name properties
            const coreTeamMembersNormalized = coreTeamMembers.map((member) => typeof member === 'string' ? { name: member } : member);
            const additionalStaffMembersNormalized = additionalStaffMembers.map((member) => typeof member === 'string' ? { name: member } : member);
            // Combine core team members and additional staff for display
            const allMembers = [
                ...coreTeamMembersNormalized.map((member) => ({
                    id: member.id || Math.random(),
                    userId: member.userId || Math.random(),
                    name: member.name,
                    clockInTime: member.clockInTime || null,
                    clockOutTime: member.clockOutTime || null,
                    teamName: job.teamName,
                    teamColor: job.teamColor,
                    isCoreTeam: true
                })),
                ...additionalStaffMembersNormalized.map((member) => ({
                    id: member.id || Math.random(),
                    userId: member.userId || Math.random(),
                    name: member.name,
                    clockInTime: member.clockInTime || null,
                    clockOutTime: member.clockOutTime || null,
                    teamName: member.teamName || 'Additional Staff',
                    teamColor: member.teamColor || '#888',
                    isCoreTeam: false
                }))
            ];
            return {
                ...job,
                efficiency,
                allocatedMinutes,
                timeDifferenceMinutes,
                wageRatio,
                members: allMembers
            };
        }));
        res.json({ success: true, data: completedCleansWithMembers });
    }
    catch (error) {
        console.error("Error fetching completed cleans:", error);
        res.status(500).json({ success: false, error: "Failed to fetch completed cleans" });
    }
});
// Get active cleans
router.get("/cleans/active", async (req, res) => {
    try {
        // Get today's date in local timezone (Melbourne time)
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        // Convert local time boundaries to UTC for database queries
        const todayUTC = new Date(today.getTime() - today.getTimezoneOffset() * 60000);
        const tomorrowUTC = new Date(tomorrow.getTime() - tomorrow.getTimezoneOffset() * 60000);
        // First, get all active jobs for today (jobs where ANY time entry has clockOutTime IS NULL)
        const activeJobs = await db
            .select({
            jobId: jobs.id,
            customerName: customers.name,
            customerAddress: customers.address,
            customerLatitude: customers.latitude,
            customerLongitude: customers.longitude,
            teamName: teams.name,
            teamColor: teams.colorHex,
            clockInTime: sql `MIN(${timeEntries.clockInTime})`
        })
            .from(jobs)
            .innerJoin(customers, eq(jobs.customerId, customers.id))
            .leftJoin(teams, eq(jobs.teamId, teams.id))
            .innerJoin(timeEntries, eq(jobs.id, timeEntries.jobId))
            .where(and(sql `${timeEntries.clockInTime} >= ${todayUTC.toISOString()}`, sql `${timeEntries.clockInTime} < ${tomorrowUTC.toISOString()}`))
            .groupBy(jobs.id, customers.name, customers.address, customers.latitude, customers.longitude, teams.name, teams.colorHex)
            .having(sql `COUNT(CASE WHEN ${timeEntries.clockOutTime} IS NULL THEN 1 END) > 0`)
            .orderBy(sql `MIN(${timeEntries.clockInTime}) DESC`);
        // For each job, get all team members who are currently working on it
        const activeCleansWithMembers = await Promise.all(activeJobs.map(async (job) => {
            const members = await db
                .select({
                id: timeEntries.id,
                userId: timeEntries.userId,
                firstName: users.firstName,
                lastName: users.lastName,
                clockInTime: timeEntries.clockInTime,
                teamName: teams.name,
                teamColor: teams.colorHex
            })
                .from(timeEntries)
                .innerJoin(users, eq(timeEntries.userId, users.id))
                .leftJoin(teamsUsers, eq(users.id, teamsUsers.userId))
                .leftJoin(teams, eq(teamsUsers.teamId, teams.id))
                .where(and(eq(timeEntries.jobId, job.jobId), sql `${timeEntries.clockOutTime} IS NULL`, 
            // Only get current active team memberships
            sql `${teamsUsers.startDate} <= CURRENT_DATE`, sql `(${teamsUsers.endDate} IS NULL OR ${teamsUsers.endDate} >= CURRENT_DATE)`, eq(teams.active, true)));
            return {
                ...job,
                members: members.map(member => ({
                    id: member.id,
                    userId: member.userId,
                    name: `${member.firstName} ${member.lastName}`,
                    clockInTime: member.clockInTime,
                    teamName: member.teamName,
                    teamColor: member.teamColor
                }))
            };
        }));
        res.json({ success: true, data: activeCleansWithMembers });
    }
    catch (error) {
        console.error("Error fetching active cleans:", error);
        res.status(500).json({ success: false, error: "Failed to fetch active cleans" });
    }
});
// Update time entry
router.put("/time-entries/:id", async (req, res) => {
    try {
        const timeEntryId = parseInt(req.params.id);
        const { clockInTime, clockOutTime } = req.body;
        if (!clockInTime) {
            return res.status(400).json({
                success: false,
                error: "Clock in time is required"
            });
        }
        // Convert local datetime strings back to UTC for database storage
        const clockInUTC = new Date(clockInTime);
        const clockOutUTC = clockOutTime ? new Date(clockOutTime) : null;
        const [updatedEntry] = await db
            .update(timeEntries)
            .set({
            clockInTime: clockInUTC,
            clockOutTime: clockOutUTC
        })
            .where(eq(timeEntries.id, timeEntryId))
            .returning();
        if (!updatedEntry) {
            return res.status(404).json({ success: false, error: "Time entry not found" });
        }
        res.json({ success: true, data: updatedEntry });
    }
    catch (error) {
        console.error("Error updating time entry:", error);
        res.status(500).json({ success: false, error: "Failed to update time entry" });
    }
});
// End active clean (clock out all team members)
router.post("/cleans/end-active", async (req, res) => {
    try {
        const { jobId } = req.body;
        if (!jobId) {
            return res.status(400).json({
                success: false,
                error: "Job ID is required"
            });
        }
        // Find all active time entries for this job
        const activeEntries = await db
            .select({
            id: timeEntries.id,
            userId: timeEntries.userId,
            clockInTime: timeEntries.clockInTime
        })
            .from(timeEntries)
            .where(and(eq(timeEntries.jobId, jobId), sql `${timeEntries.clockOutTime} IS NULL`));
        if (activeEntries.length === 0) {
            return res.status(404).json({
                success: false,
                error: "No active time entries found for this job"
            });
        }
        const clockOutTime = new Date();
        const updatedEntries = [];
        // Update all active time entries for this job
        for (const entry of activeEntries) {
            const clockInTime = entry.clockInTime;
            if (!clockInTime) {
                continue;
            }
            // Auto lunch deduction logic
            const clockInHour = clockInTime.getHours();
            const clockOutHour = clockOutTime.getHours();
            const shouldAutoDeductLunch = clockInHour < 12 && clockOutHour > 12;
            const [updatedEntry] = await db
                .update(timeEntries)
                .set({
                clockOutTime: clockOutTime,
                lunchBreak: shouldAutoDeductLunch,
                autoLunchDeducted: shouldAutoDeductLunch
            })
                .where(eq(timeEntries.id, entry.id))
                .returning();
            updatedEntries.push(updatedEntry);
        }
        // Since we clocked out ALL active entries for this job, it's definitely completed
        console.log(`Job ${jobId} is fully completed (admin), calculating customer metrics...`);
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
        res.json({
            success: true,
            data: {
                message: `Ended clean successfully for ${updatedEntries.length} team member(s)`,
                updatedEntries
            }
        });
    }
    catch (error) {
        console.error("Error ending active clean:", error);
        res.status(500).json({ success: false, error: "Failed to end active clean" });
    }
});
// Update job times (for admin editing)
router.put("/cleans/:jobId", async (req, res) => {
    try {
        const jobId = parseInt(req.params.jobId);
        const { clockInTime, clockOutTime } = req.body;
        if (!clockInTime) {
            return res.status(400).json({
                success: false,
                error: "Clock in time is required"
            });
        }
        // Convert UTC datetime strings to Date objects
        const clockInUTC = new Date(clockInTime);
        const clockOutUTC = clockOutTime ? new Date(clockOutTime) : null;
        // Find all time entries for this job
        const jobEntries = await db
            .select({
            id: timeEntries.id,
            userId: timeEntries.userId,
            clockInTime: timeEntries.clockInTime,
            clockOutTime: timeEntries.clockOutTime
        })
            .from(timeEntries)
            .where(eq(timeEntries.jobId, jobId));
        if (jobEntries.length === 0) {
            return res.status(404).json({
                success: false,
                error: "No time entries found for this job"
            });
        }
        const updatedEntries = [];
        // Update all time entries for this job with the new times
        for (const entry of jobEntries) {
            const [updatedEntry] = await db
                .update(timeEntries)
                .set({
                clockInTime: clockInUTC,
                clockOutTime: clockOutUTC
            })
                .where(eq(timeEntries.id, entry.id))
                .returning();
            updatedEntries.push(updatedEntry);
        }
        // If clock-out time was set, check if the job is now fully completed
        if (clockOutUTC) {
            const remainingActiveEntries = await db
                .select({ count: sql `COUNT(*)` })
                .from(timeEntries)
                .where(and(eq(timeEntries.jobId, jobId), sql `${timeEntries.clockOutTime} IS NULL`));
            // If no active entries remain, the job is fully completed
            if (remainingActiveEntries[0].count === 0) {
                console.log(`Job ${jobId} is fully completed (admin edit), calculating customer metrics...`);
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
        }
        // Send SSE event to all connected staff about the job update
        console.log('🔄 Sending SSE event for job update:', { jobId, clockInTime: clockInUTC, clockOutTime: clockOutUTC });
        try {
            const { broadcastSSEEvent } = await import('./staff');
            broadcastSSEEvent({
                type: 'job_updated',
                jobId,
                clockInTime: clockInUTC,
                clockOutTime: clockOutUTC,
                updatedEntries: updatedEntries.length,
                timestamp: new Date()
            });
            console.log('✅ SSE event sent successfully');
        }
        catch (error) {
            console.error('❌ Failed to send SSE event for job update:', error);
        }
        res.json({
            success: true,
            data: {
                message: `Updated times for ${updatedEntries.length} time entry(ies)`,
                updatedEntries
            }
        });
    }
    catch (error) {
        console.error("Error updating job times:", error);
        res.status(500).json({ success: false, error: "Failed to update job times" });
    }
});
// Get dashboard summary
router.get("/dashboard", async (req, res) => {
    try {
        const dateFilter = req.query.dateFilter || 'today';
        // Get date range based on filter
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        let startDate, endDate;
        switch (dateFilter) {
            case 'yesterday':
                startDate = new Date(today.getTime() - 24 * 60 * 60 * 1000);
                endDate = today;
                break;
            case 'thisWeek':
                // Get Monday of current week (assuming Monday is start of work week)
                const dayOfWeek = today.getDay();
                const monday = new Date(today.getTime() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1) * 24 * 60 * 60 * 1000);
                const friday = new Date(monday.getTime() + 5 * 24 * 60 * 60 * 1000);
                startDate = monday;
                endDate = new Date(friday.getTime() + 24 * 60 * 60 * 1000);
                break;
            default: // today
                startDate = today;
                endDate = new Date(today.getTime() + 24 * 60 * 60 * 1000);
                break;
        }
        // Use local time boundaries directly (same as frontend logic)
        const startUTC = startDate;
        const endUTC = endDate;
        // Active cleans count (jobs where ANY time entry has clockOutTime IS NULL)
        const activeCleans = await db
            .select({ count: sql `COUNT(DISTINCT ${timeEntries.jobId})` })
            .from(timeEntries)
            .where(sql `${timeEntries.clockOutTime} IS NULL`);
        // Completed cleans for selected date range (jobs where ALL time entries have clockOutTime) - using local completion time
        const completedCleansForPeriod = await db
            .select({ count: sql `COUNT(*)` })
            .from(db
            .select({ jobId: timeEntries.jobId })
            .from(timeEntries)
            .where(and(sql `${timeEntries.clockOutTime} >= ${startUTC.toISOString()}`, sql `${timeEntries.clockOutTime} < ${endUTC.toISOString()}`))
            .groupBy(timeEntries.jobId)
            .having(sql `COUNT(CASE WHEN ${timeEntries.clockOutTime} IS NULL THEN 1 END) = 0`)
            .as('completedJobs'));
        // Fetch staff pay rate from settings
        const payRateRowDashboard = await db
            .select()
            .from(settings)
            .where(eq(settings.key, "staff_pay_rate_per_hour"))
            .limit(1);
        const staffPayRatePerHourDashboard = Number(payRateRowDashboard[0]?.value ?? 32.31); // Default to $32.31/hour if not set
        // Calculate efficiency per job, then average across all jobs
        // Use job duration (earliest start to latest finish) like individual job efficiency
        const jobEfficiencyData = await db
            .select({
            jobId: jobs.id,
            customerId: customers.id,
            customerName: customers.name,
            customerPrice: customers.price,
            isFriendsFamily: customers.isFriendsFamily,
            actualJobDuration: sql `
          EXTRACT(EPOCH FROM (
            MAX(${timeEntries.clockOutTime}) - MIN(${timeEntries.clockInTime})
          )) / 3600
        `
        })
            .from(timeEntries)
            .innerJoin(jobs, eq(timeEntries.jobId, jobs.id))
            .innerJoin(customers, eq(jobs.customerId, customers.id))
            .where(and(sql `${timeEntries.clockOutTime} >= ${startUTC.toISOString()}`, sql `${timeEntries.clockOutTime} < ${endUTC.toISOString()}`, sql `${timeEntries.clockOutTime} IS NOT NULL`, eq(customers.isFriendsFamily, false) // Exclude friends & family customers
        ))
            .groupBy(jobs.id, customers.id, customers.name, customers.price, customers.isFriendsFamily);
        // Calculate efficiency for each job and then average
        let totalEfficiency = 0;
        let jobCount = 0;
        for (const job of jobEfficiencyData) {
            if (job.actualJobDuration > 0) {
                // Get the expected time from price tiers based on customer price
                const priceTier = await db
                    .select({
                    allottedMinutes: timeAllocationTiers.allottedMinutes
                })
                    .from(timeAllocationTiers)
                    .where(and(sql `${timeAllocationTiers.priceMin} <= ${job.customerPrice}`, sql `${timeAllocationTiers.priceMax} >= ${job.customerPrice}`))
                    .limit(1);
                let expectedTime = 1.5; // Default 1.5 hours (90 minutes) if no tier found
                if (priceTier.length > 0) {
                    expectedTime = priceTier[0].allottedMinutes / 60; // Convert minutes to hours
                }
                // Job efficiency = expected time / actual time
                const jobEfficiency = (expectedTime / job.actualJobDuration) * 100;
                const roundedEfficiency = Math.max(Math.round(jobEfficiency), 0);
                totalEfficiency += roundedEfficiency;
                jobCount++;
            }
        }
        const averageEfficiency = jobCount > 0 ? totalEfficiency / jobCount : 100;
        const efficiencyPercentage = Math.max(Math.round(averageEfficiency), 0); // Only clamp to 0, allow >100%
        // Calculate revenue for selected date range - only for fully completed jobs using local completion time
        const revenueData = await db
            .select({
            revenue: sql `
          COALESCE(
            SUM(price), 
            0
          )
        `
        })
            .from(db
            .select({
            jobId: timeEntries.jobId,
            price: customers.price
        })
            .from(timeEntries)
            .innerJoin(jobs, eq(timeEntries.jobId, jobs.id))
            .innerJoin(customers, eq(jobs.customerId, customers.id))
            .where(and(sql `${timeEntries.clockOutTime} >= ${startUTC.toISOString()}`, sql `${timeEntries.clockOutTime} < ${endUTC.toISOString()}`, eq(customers.isFriendsFamily, false) // Exclude friends & family customers
        ))
            .groupBy(timeEntries.jobId, customers.price)
            .having(sql `COUNT(CASE WHEN ${timeEntries.clockOutTime} IS NULL THEN 1 END) = 0`)
            .as('completedJobs'));
        // Calculate total wages for completed jobs in the selected date range
        const wagesData = await db
            .select({
            totalWages: sql `
          COALESCE(
            SUM(
              EXTRACT(EPOCH FROM (${timeEntries.clockOutTime} - ${timeEntries.clockInTime})) / 3600 * ${staffPayRatePerHourDashboard}
            ),
            0
          )
        `
        })
            .from(timeEntries)
            .innerJoin(jobs, eq(timeEntries.jobId, jobs.id))
            .innerJoin(customers, eq(jobs.customerId, customers.id))
            .where(and(sql `${timeEntries.clockOutTime} >= ${startUTC.toISOString()}`, sql `${timeEntries.clockOutTime} < ${endUTC.toISOString()}`, sql `${timeEntries.clockOutTime} IS NOT NULL`, eq(customers.isFriendsFamily, false) // Exclude friends & family customers
        ));
        // Calculate wage ratio
        const totalRevenue = revenueData[0]?.revenue || 0;
        const totalWages = wagesData[0]?.totalWages || 0;
        const wageRatio = totalRevenue > 0 ? Math.round((totalWages / totalRevenue) * 100) : 0;
        res.json({
            success: true,
            data: {
                activeCleans: activeCleans[0]?.count || 0,
                completedCleans: completedCleansForPeriod[0]?.count || 0,
                efficiency: efficiencyPercentage,
                revenue: Math.round(totalRevenue),
                wageRatio: wageRatio
            }
        });
    }
    catch (error) {
        console.error("Error fetching dashboard data:", error);
        res.status(500).json({ success: false, error: "Failed to fetch dashboard data" });
    }
});
// Get timesheet reports
router.get("/reports/timesheets", async (req, res) => {
    try {
        // Fetch lunch break settings
        const settingsKeys = [
            "lunch_break_min_hours",
            "lunch_break_duration_minutes",
            "lunch_break_start_time",
            "lunch_break_finish_time"
        ];
        const settingsRows = await db
            .select()
            .from(settings)
            .where(inArray(settings.key, settingsKeys));
        const settingsMap = {};
        for (const row of settingsRows) {
            settingsMap[row.key] = row.value;
        }
        const lunchBreakSettings = {
            minHours: Number(settingsMap["lunch_break_min_hours"] ?? 5),
            durationMinutes: Number(settingsMap["lunch_break_duration_minutes"] ?? 30),
            startTime: settingsMap["lunch_break_start_time"] ?? "09:00",
            finishTime: settingsMap["lunch_break_finish_time"] ?? "17:00"
        };
        const weekFilter = req.query.weekFilter || 'thisWeek';
        // Calculate date range based on week filter
        const now = new Date();
        // Use local time to match frontend and time entry data
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
        let startOfWeek;
        if (weekFilter === 'lastWeek') {
            // Last week: go back 7 days from current week start
            startOfWeek = new Date(today.getTime() - (dayOfWeek + 7) * 24 * 60 * 60 * 1000);
        }
        else {
            // This week: go back to Monday of current week
            // If today is Sunday (0), we go back 6 days to get to Monday
            // If today is Monday (1), we go back 0 days
            // If today is Tuesday (2), we go back 1 day, etc.
            const daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
            startOfWeek = new Date(today.getTime() - daysToSubtract * 24 * 60 * 60 * 1000);
        }
        const endOfWeek = new Date(startOfWeek.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days after start (Monday to next Monday, includes all of Sunday)
        // Debug logging
        console.log('Timesheet Debug Info:');
        console.log('Today:', today.toISOString());
        console.log('Day of week:', dayOfWeek);
        console.log('Week filter:', weekFilter);
        console.log('Start of week:', startOfWeek.toISOString());
        console.log('End of week:', endOfWeek.toISOString());
        // Get all time entries for the week
        // For debugging, if no entries found in current week, get all entries from the last 30 days
        let weekTimeEntries = await db
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
            .where(and(sql `${timeEntries.clockInTime} >= ${startOfWeek.toISOString()}`, sql `${timeEntries.clockInTime} < ${endOfWeek.toISOString()}`));
        console.log('Time entries found for week:', weekTimeEntries.length);
        if (weekTimeEntries.length > 0) {
            console.log('Sample time entry:', weekTimeEntries[0]);
        }
        // If no entries found for current week, get recent entries for testing
        if (weekTimeEntries.length === 0) {
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            weekTimeEntries = await db
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
                .where(sql `${timeEntries.clockInTime} >= ${thirtyDaysAgo.toISOString()}`);
        }
        // Group by user and calculate daily hours
        const userTimesheets = new Map();
        let totalHours = 0;
        let allJobIds = new Set();
        // First, group entries by user and day to calculate daily time spans
        const userDailyEntries = new Map();
        weekTimeEntries.forEach(entry => {
            const userId = entry.userId;
            const staffName = `${entry.firstName} ${entry.lastName}`;
            if (!entry.clockInTime) {
                return;
            }
            const clockIn = entry.clockInTime;
            const dayOfWeek = clockIn.getDay();
            // Create a unique key for user + day
            const dayKey = `${userId}-${dayOfWeek}`;
            if (!userDailyEntries.has(dayKey)) {
                userDailyEntries.set(dayKey, {
                    userId,
                    staffName,
                    dayOfWeek,
                    entries: [],
                    firstClockIn: null,
                    lastClockOut: null
                });
            }
            const dailyData = userDailyEntries.get(dayKey);
            dailyData.entries.push(entry);
            // Track first clock-in and last clock-out for the day
            if (!dailyData.firstClockIn || clockIn < dailyData.firstClockIn) {
                dailyData.firstClockIn = clockIn;
            }
            if (entry.clockOutTime && (!dailyData.lastClockOut || entry.clockOutTime > dailyData.lastClockOut)) {
                dailyData.lastClockOut = entry.clockOutTime;
            }
            // Track unique jobIds for completed cleans
            if (entry.jobId && entry.clockOutTime) {
                allJobIds.add(entry.jobId);
            }
        });
        // Fetch all lunch break overrides for the week
        const overrides = await db
            .select()
            .from(lunchBreakOverrides)
            .where(sql `"date" >= ${startOfWeek.toISOString().slice(0, 10)} AND "date" < ${endOfWeek.toISOString().slice(0, 10)}`);
        // Now calculate timesheets based on daily time spans
        userDailyEntries.forEach((dailyData, dayKey) => {
            const userId = dailyData.userId;
            const staffName = dailyData.staffName;
            const dayOfWeek = dailyData.dayOfWeek;
            if (!userTimesheets.has(userId)) {
                userTimesheets.set(userId, {
                    staffName,
                    monday: { hours: 0, jobs: 0, lunchBreak: false, startTime: null, endTime: null },
                    tuesday: { hours: 0, jobs: 0, lunchBreak: false, startTime: null, endTime: null },
                    wednesday: { hours: 0, jobs: 0, lunchBreak: false, startTime: null, endTime: null },
                    thursday: { hours: 0, jobs: 0, lunchBreak: false, startTime: null, endTime: null },
                    friday: { hours: 0, jobs: 0, lunchBreak: false, startTime: null, endTime: null },
                    saturday: { hours: 0, jobs: 0, lunchBreak: false, startTime: null, endTime: null },
                    sunday: { hours: 0, jobs: 0, lunchBreak: false, startTime: null, endTime: null },
                    totalHours: 0,
                    totalJobs: 0
                });
            }
            const timesheet = userTimesheets.get(userId);
            // Calculate total daily hours from first clock-in to last clock-out
            let dailyHours = 0;
            let lunchBreakApplied = false;
            let lunchBreakDebug = {
                hasOverride: false,
                overrideValue: null,
                rules: {
                    minHours: lunchBreakSettings.minHours,
                    actualHours: 0,
                    minJobs: 2,
                    actualJobs: 0,
                    startTime: lunchBreakSettings.startTime,
                    finishTime: lunchBreakSettings.finishTime,
                    actualStartTime: null,
                    actualFinishTime: null
                },
                conditions: [
                    { name: 'Hours', passed: false, description: '' },
                    { name: 'Jobs', passed: false, description: '' },
                    { name: 'Start Time', passed: false, description: '' },
                    { name: 'Finish Time', passed: false, description: '' }
                ]
            };
            if (dailyData.firstClockIn && dailyData.lastClockOut) {
                dailyHours = (dailyData.lastClockOut.getTime() - dailyData.firstClockIn.getTime()) / (1000 * 60 * 60);
                // Set debug info
                lunchBreakDebug.rules.actualHours = Math.round(dailyHours * 100) / 100;
                lunchBreakDebug.rules.actualJobs = dailyData.entries.length;
                lunchBreakDebug.rules.actualStartTime = dailyData.firstClockIn.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
                lunchBreakDebug.rules.actualFinishTime = dailyData.lastClockOut.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
                // Find override for this user and date
                const dateObj = dailyData.firstClockIn ? new Date(dailyData.firstClockIn) : null;
                const dateStr = dateObj ? dateObj.toISOString().slice(0, 10) : null;
                const override = overrides.find(o => o.userId === userId && String(o.date).slice(0, 10) === dateStr);
                if (override) {
                    // Manual override exists
                    lunchBreakDebug.hasOverride = true;
                    lunchBreakDebug.overrideValue = override.hasLunchBreak;
                    lunchBreakApplied = override.hasLunchBreak;
                    if (lunchBreakApplied) {
                        dailyHours -= lunchBreakSettings.durationMinutes / 60; // Use settings duration
                        lunchBreakDebug.conditions[0].passed = true;
                        lunchBreakDebug.conditions[0].description = `Manual override: ${override.hasLunchBreak ? 'Applied' : 'Not applied'}`;
                    }
                }
                else {
                    // Automatic lunch break logic using settings
                    const hoursRule = dailyHours >= lunchBreakSettings.minHours;
                    const jobsRule = dailyData.entries.length >= 2;
                    // Check start time eligibility
                    const startTimeRule = (() => {
                        if (!lunchBreakSettings.startTime || !dailyData.firstClockIn)
                            return true;
                        const startTimeParts = lunchBreakSettings.startTime.split(':');
                        const startHour = parseInt(startTimeParts[0]);
                        const startMinute = parseInt(startTimeParts[1]);
                        const clockInHour = dailyData.firstClockIn.getHours();
                        const clockInMinute = dailyData.firstClockIn.getMinutes();
                        const clockInMinutes = clockInHour * 60 + clockInMinute;
                        const startMinutes = startHour * 60 + startMinute;
                        return clockInMinutes < startMinutes;
                    })();
                    // Check finish time eligibility
                    const finishTimeRule = (() => {
                        if (!lunchBreakSettings.finishTime || !dailyData.lastClockOut)
                            return true;
                        const finishTimeParts = lunchBreakSettings.finishTime.split(':');
                        const finishHour = parseInt(finishTimeParts[0]);
                        const finishMinute = parseInt(finishTimeParts[1]);
                        const clockOutHour = dailyData.lastClockOut.getHours();
                        const clockOutMinute = dailyData.lastClockOut.getMinutes();
                        const clockOutMinutes = clockOutHour * 60 + clockOutMinute;
                        const finishMinutes = finishHour * 60 + finishMinute;
                        return clockOutMinutes > finishMinutes;
                    })();
                    if (hoursRule) {
                        lunchBreakDebug.conditions[0].passed = true;
                        lunchBreakDebug.conditions[0].description = `${lunchBreakDebug.rules.actualHours}h >= ${lunchBreakSettings.minHours}h`;
                    }
                    else {
                        lunchBreakDebug.conditions[0].passed = false;
                        lunchBreakDebug.conditions[0].description = `${lunchBreakDebug.rules.actualHours}h < ${lunchBreakSettings.minHours}h`;
                    }
                    if (jobsRule) {
                        lunchBreakDebug.conditions[1].passed = true;
                        lunchBreakDebug.conditions[1].description = `${dailyData.entries.length} >= 2`;
                    }
                    else {
                        lunchBreakDebug.conditions[1].passed = false;
                        lunchBreakDebug.conditions[1].description = `${dailyData.entries.length} < 2`;
                    }
                    if (startTimeRule) {
                        lunchBreakDebug.conditions[2].passed = true;
                        lunchBreakDebug.conditions[2].description = `${lunchBreakDebug.rules.actualStartTime} < ${lunchBreakSettings.startTime}`;
                    }
                    else {
                        lunchBreakDebug.conditions[2].passed = false;
                        lunchBreakDebug.conditions[2].description = `${lunchBreakDebug.rules.actualStartTime} >= ${lunchBreakSettings.startTime}`;
                    }
                    if (finishTimeRule) {
                        lunchBreakDebug.conditions[3].passed = true;
                        lunchBreakDebug.conditions[3].description = `${lunchBreakDebug.rules.actualFinishTime} > ${lunchBreakSettings.finishTime}`;
                    }
                    else {
                        lunchBreakDebug.conditions[3].passed = false;
                        lunchBreakDebug.conditions[3].description = `${lunchBreakDebug.rules.actualFinishTime} <= ${lunchBreakSettings.finishTime}`;
                    }
                    const shouldApplyLunchBreak = hoursRule && jobsRule && startTimeRule && finishTimeRule;
                    if (shouldApplyLunchBreak) {
                        dailyHours -= lunchBreakSettings.durationMinutes / 60; // Convert minutes to hours
                        lunchBreakApplied = true;
                    }
                }
            }
            // Map day of week to our structure (0 = Sunday, 1 = Monday, etc.)
            const dayMap = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
            const dayKeyName = dayMap[dayOfWeek];
            timesheet[dayKeyName].hours = Math.round(dailyHours * 100) / 100; // Round to 2 decimal places
            timesheet[dayKeyName].jobs = dailyData.entries.length;
            timesheet[dayKeyName].lunchBreak = lunchBreakApplied;
            timesheet[dayKeyName].startTime = dailyData.firstClockIn ? dailyData.firstClockIn.toISOString() : null;
            timesheet[dayKeyName].endTime = dailyData.lastClockOut ? dailyData.lastClockOut.toISOString() : null;
            timesheet[dayKeyName].lunchBreakDebug = lunchBreakDebug;
            timesheet.totalHours += dailyHours;
            timesheet.totalJobs += dailyData.entries.length;
            totalHours += dailyHours;
        });
        const weeklyData = Array.from(userTimesheets.values());
        // Round totals to 2 decimal places
        weeklyData.forEach(timesheet => {
            timesheet.totalHours = Math.round(timesheet.totalHours * 100) / 100;
        });
        res.json({
            success: true,
            data: {
                weekly: weeklyData,
                stats: {
                    totalHours: Math.round(totalHours * 100) / 100,
                    totalJobs: allJobIds.size
                }
            }
        });
    }
    catch (error) {
        console.error("Error fetching timesheet data:", error);
        res.status(500).json({ success: false, error: "Failed to fetch timesheet data" });
    }
});
// Test endpoint to check if lunch break overrides table exists
router.get("/test/lunch-break-table", async (req, res) => {
    try {
        const result = await db.select().from(lunchBreakOverrides).limit(1);
        res.json({
            success: true,
            message: "Table exists and is accessible",
            count: result.length
        });
    }
    catch (error) {
        console.error("Error testing lunch break overrides table:", error);
        res.status(500).json({
            success: false,
            error: "Table test failed",
            details: error instanceof Error ? error.message : "Unknown error"
        });
    }
});
// Test endpoint to check settings table and current values
router.get("/test/settings-table", async (req, res) => {
    try {
        const result = await db.select().from(settings).where(sql `"key" LIKE 'lunch_break_%'`);
        res.json({
            success: true,
            message: "Settings table exists and is accessible",
            settings: result
        });
    }
    catch (error) {
        console.error("Error testing settings table:", error);
        res.status(500).json({
            success: false,
            error: "Settings table test failed",
            details: error instanceof Error ? error.message : "Unknown error"
        });
    }
});
// Update lunch break override for a staff member
router.post("/timesheets/lunch-break", async (req, res) => {
    try {
        const { staffName, date, hasLunchBreak } = req.body;
        if (!staffName || !date || typeof hasLunchBreak !== 'boolean') {
            return res.status(400).json({
                success: false,
                error: "Staff name, date, and lunch break status are required"
            });
        }
        // Find the user by name
        const [firstName, lastName] = staffName.split(' ');
        const user = await db
            .select({ id: users.id })
            .from(users)
            .where(and(eq(users.firstName, firstName), eq(users.lastName, lastName)))
            .limit(1);
        if (user.length === 0) {
            return res.status(404).json({
                success: false,
                error: "Staff member not found"
            });
        }
        const staffId = user[0].id;
        // Upsert the override
        await db
            .insert(lunchBreakOverrides)
            .values({ userId: staffId, date, hasLunchBreak })
            .onConflictDoUpdate({ target: [lunchBreakOverrides.userId, lunchBreakOverrides.date], set: { hasLunchBreak } });
        res.json({
            success: true,
            message: "Lunch break override saved successfully",
            data: { staffId, staffName, date, hasLunchBreak }
        });
    }
    catch (error) {
        console.error("Error updating lunch break override:", error);
        console.error("Request body:", req.body);
        res.status(500).json({
            success: false,
            error: "Failed to update lunch break override",
            details: error instanceof Error ? error.message : "Unknown error"
        });
    }
});
// === LUNCH BREAK SETTINGS ===
// Get lunch break settings
router.get("/settings/lunch-break", async (req, res) => {
    try {
        const settingsKeys = [
            "lunch_break_min_hours",
            "lunch_break_duration_minutes",
            "lunch_break_start_time",
            "lunch_break_finish_time"
        ];
        const settingsRows = await db
            .select()
            .from(settings)
            .where(inArray(settings.key, settingsKeys));
        const settingsMap = {};
        for (const row of settingsRows) {
            settingsMap[row.key] = row.value;
        }
        const responseData = {
            minHours: Number(settingsMap["lunch_break_min_hours"] ?? 5),
            durationMinutes: Number(settingsMap["lunch_break_duration_minutes"] ?? 30),
            startTime: settingsMap["lunch_break_start_time"] ?? "09:00",
            finishTime: settingsMap["lunch_break_finish_time"] ?? "17:00"
        };
        res.json({
            success: true,
            data: responseData
        });
    }
    catch (error) {
        console.error("Error fetching lunch break settings:", error);
        res.status(500).json({ success: false, error: "Failed to fetch lunch break settings" });
    }
});
// Update lunch break settings
router.put("/settings/lunch-break", async (req, res) => {
    try {
        const { minHours, durationMinutes, startTime, finishTime } = req.body;
        const updates = [
            { key: "lunch_break_min_hours", value: String(minHours ?? 5) },
            { key: "lunch_break_duration_minutes", value: String(durationMinutes ?? 30) },
            { key: "lunch_break_start_time", value: startTime ?? "09:00" },
            { key: "lunch_break_finish_time", value: finishTime ?? "17:00" }
        ];
        for (const { key, value } of updates) {
            try {
                const result = await db
                    .insert(settings)
                    .values({ key, value })
                    .onConflictDoUpdate({ target: settings.key, set: { value } });
            }
            catch (upsertError) {
                console.error(`[Settings] Upsert failed for ${key}:`, upsertError);
                throw upsertError;
            }
        }
        res.json({ success: true });
    }
    catch (error) {
        console.error("Error updating lunch break settings:", error);
        res.status(500).json({ success: false, error: "Failed to update lunch break settings", details: error instanceof Error ? error.message : error });
    }
});
// === STAFF PAY RATE SETTINGS ===
// Get staff pay rate settings
router.get("/settings/staff-pay-rate", async (req, res) => {
    try {
        const settingsKeys = ["staff_pay_rate_per_hour"];
        const settingsRows = await db
            .select()
            .from(settings)
            .where(inArray(settings.key, settingsKeys));
        const settingsMap = {};
        for (const row of settingsRows) {
            settingsMap[row.key] = row.value;
        }
        const responseData = {
            payRatePerHour: Number(settingsMap["staff_pay_rate_per_hour"] ?? 32.31)
        };
        res.json({
            success: true,
            data: responseData
        });
    }
    catch (error) {
        console.error("Error fetching staff pay rate settings:", error);
        res.status(500).json({ success: false, error: "Failed to fetch staff pay rate settings" });
    }
});
// Update staff pay rate settings
router.put("/settings/staff-pay-rate", async (req, res) => {
    try {
        const { payRatePerHour } = req.body;
        const updates = [
            { key: "staff_pay_rate_per_hour", value: String(payRatePerHour ?? 32.31) }
        ];
        for (const { key, value } of updates) {
            try {
                const result = await db
                    .insert(settings)
                    .values({ key, value })
                    .onConflictDoUpdate({ target: settings.key, set: { value } });
            }
            catch (upsertError) {
                console.error(`[Settings] Upsert failed for ${key}:`, upsertError);
                throw upsertError;
            }
        }
        res.json({ success: true });
    }
    catch (error) {
        console.error("Error updating staff pay rate settings:", error);
        res.status(500).json({ success: false, error: "Failed to update staff pay rate settings", details: error instanceof Error ? error.message : error });
    }
});
// === GEOLOCATION RADIUS SETTINGS ===
// Get geolocation radius settings
router.get("/settings/geolocation-radius", async (req, res) => {
    try {
        const settingsKeys = ["geolocation_radius_meters"];
        const settingsRows = await db
            .select()
            .from(settings)
            .where(inArray(settings.key, settingsKeys));
        const settingsMap = {};
        for (const row of settingsRows) {
            settingsMap[row.key] = row.value;
        }
        const responseData = {
            radiusMeters: Number(settingsMap["geolocation_radius_meters"] ?? 50000) // Default 50km
        };
        res.json({
            success: true,
            data: responseData
        });
    }
    catch (error) {
        console.error("Error fetching geolocation radius settings:", error);
        res.status(500).json({ success: false, error: "Failed to fetch geolocation radius settings" });
    }
});
// Update geolocation radius settings
router.put("/settings/geolocation-radius", async (req, res) => {
    try {
        const { radiusMeters } = req.body;
        const updates = [
            { key: "geolocation_radius_meters", value: String(radiusMeters ?? 50000) }
        ];
        for (const { key, value } of updates) {
            try {
                const result = await db
                    .insert(settings)
                    .values({ key, value })
                    .onConflictDoUpdate({ target: settings.key, set: { value } });
            }
            catch (upsertError) {
                console.error(`[Settings] Upsert failed for ${key}:`, upsertError);
                throw upsertError;
            }
        }
        res.json({ success: true });
    }
    catch (error) {
        console.error("Error updating geolocation radius settings:", error);
        res.status(500).json({ success: false, error: "Failed to update geolocation radius settings", details: error instanceof Error ? error.message : error });
    }
});
// === CUSTOMER PRICE TIERS ===
// Get all price tiers
router.get("/settings/price-tiers", async (req, res) => {
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
// Add new price tier
router.post("/settings/price-tiers", async (req, res) => {
    try {
        const { priceMin, priceMax, allottedMinutes } = req.body;
        if (!priceMin || !priceMax || !allottedMinutes) {
            return res.status(400).json({
                success: false,
                error: "Price min, price max, and allotted minutes are required"
            });
        }
        const newTier = await db
            .insert(timeAllocationTiers)
            .values({
            priceMin: parseFloat(priceMin).toFixed(2),
            priceMax: parseFloat(priceMax).toFixed(2),
            allottedMinutes: Number(allottedMinutes)
        })
            .returning();
        res.json({
            success: true,
            data: newTier[0]
        });
    }
    catch (error) {
        console.error("Error adding price tier:", error);
        res.status(500).json({ success: false, error: "Failed to add price tier" });
    }
});
// Update price tier
router.put("/settings/price-tiers/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const { priceMin, priceMax, allottedMinutes } = req.body;
        if (!priceMin || !priceMax || !allottedMinutes) {
            return res.status(400).json({
                success: false,
                error: "Price min, price max, and allotted minutes are required"
            });
        }
        const updatedTier = await db
            .update(timeAllocationTiers)
            .set({
            priceMin: parseFloat(priceMin).toFixed(2),
            priceMax: parseFloat(priceMax).toFixed(2),
            allottedMinutes: Number(allottedMinutes)
        })
            .where(eq(timeAllocationTiers.id, Number(id)))
            .returning();
        if (updatedTier.length === 0) {
            return res.status(404).json({
                success: false,
                error: "Price tier not found"
            });
        }
        res.json({
            success: true,
            data: updatedTier[0]
        });
    }
    catch (error) {
        console.error("Error updating price tier:", error);
        res.status(500).json({ success: false, error: "Failed to update price tier" });
    }
});
// Delete price tier
router.delete("/settings/price-tiers/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const deletedTier = await db
            .delete(timeAllocationTiers)
            .where(eq(timeAllocationTiers.id, Number(id)))
            .returning();
        if (deletedTier.length === 0) {
            return res.status(404).json({
                success: false,
                error: "Price tier not found"
            });
        }
        res.json({
            success: true,
            data: deletedTier[0]
        });
    }
    catch (error) {
        console.error("Error deleting price tier:", error);
        res.status(500).json({ success: false, error: "Failed to delete price tier" });
    }
});
// === CUSTOMER METRICS ===
// Helper function to calculate metrics for a specific customer
async function calculateCustomerMetrics(customerId) {
    try {
        // Fetch staff pay rate from settings
        const payRateRow = await db
            .select()
            .from(settings)
            .where(eq(settings.key, "staff_pay_rate_per_hour"))
            .limit(1);
        const staffPayRatePerHour = Number(payRateRow[0]?.value ?? 32.31);
        // Get customer info
        const customerInfo = await db
            .select({
            id: customers.id,
            name: customers.name,
            price: customers.price,
            isFriendsFamily: customers.isFriendsFamily
        })
            .from(customers)
            .where(eq(customers.id, customerId))
            .limit(1);
        if (customerInfo.length === 0) {
            console.log(`Customer ${customerId} not found for metrics calculation`);
            return;
        }
        const customer = customerInfo[0];
        // Skip metrics calculation for friends & family customers
        if (customer.isFriendsFamily) {
            console.log(`Skipping metrics calculation for friends & family customer: ${customer.name}`);
            return;
        }
        // Get all completed jobs for this customer
        const completedJobs = await db
            .select({
            jobId: jobs.id,
            price: customers.price,
            actualJobDuration: sql `
          EXTRACT(EPOCH FROM (
            MAX(${timeEntries.clockOutTime}) - MIN(${timeEntries.clockInTime})
          )) / 3600
        `,
            totalWages: sql `
          COALESCE(
            SUM(
              EXTRACT(EPOCH FROM (${timeEntries.clockOutTime} - ${timeEntries.clockInTime})) / 3600 * ${staffPayRatePerHour}
            ),
            0
          )
        `
        })
            .from(timeEntries)
            .innerJoin(jobs, eq(timeEntries.jobId, jobs.id))
            .innerJoin(customers, eq(jobs.customerId, customers.id))
            .where(and(eq(jobs.customerId, customer.id), sql `${timeEntries.clockOutTime} IS NOT NULL`))
            .groupBy(jobs.id, customers.price);
        if (completedJobs.length === 0) {
            // No completed jobs, set default values
            await db
                .update(customers)
                .set({
                targetTimeMinutes: null,
                averageWageRatio: null
            })
                .where(eq(customers.id, customer.id));
            console.log(`No completed jobs for customer ${customer.name}, set default metrics`);
            return;
        }
        // Calculate metrics for each job
        let totalEfficiency = 0;
        let totalWageRatio = 0;
        let validJobs = 0;
        for (const job of completedJobs) {
            if (job.actualJobDuration > 0) {
                // Get the expected time from price tiers based on customer price
                const priceTier = await db
                    .select({
                    allottedMinutes: timeAllocationTiers.allottedMinutes
                })
                    .from(timeAllocationTiers)
                    .where(and(sql `${timeAllocationTiers.priceMin} <= ${job.price}`, sql `${timeAllocationTiers.priceMax} >= ${job.price}`))
                    .limit(1);
                let expectedTime = 1.5; // Default 1.5 hours (90 minutes) if no tier found
                if (priceTier.length > 0) {
                    expectedTime = priceTier[0].allottedMinutes / 60; // Convert minutes to hours
                }
                // Calculate efficiency for this job
                const jobEfficiency = (expectedTime / job.actualJobDuration) * 100;
                const roundedEfficiency = Math.max(Math.round(jobEfficiency), 0);
                totalEfficiency += roundedEfficiency;
                // Calculate wage ratio for this job
                const jobWageRatio = job.price > 0 ? Math.round((job.totalWages / job.price) * 100) : 0;
                totalWageRatio += jobWageRatio;
                console.log(`Job ${job.jobId}: Expected ${expectedTime}h, Actual ${Number(job.actualJobDuration).toFixed(2)}h, Efficiency ${roundedEfficiency}%`);
                validJobs++;
            }
        }
        // Calculate averages
        const averageEfficiency = validJobs > 0 ? totalEfficiency / validJobs : 0;
        const averageWageRatio = validJobs > 0 ? totalWageRatio / validJobs : 0;
        console.log(`Customer ${customer.name}: Total efficiency ${totalEfficiency}, Valid jobs ${validJobs}, Average efficiency ${averageEfficiency.toFixed(2)}%`);
        // Update customer with calculated metrics (only store wage ratio, target time is calculated dynamically)
        await db
            .update(customers)
            .set({
            targetTimeMinutes: null, // Don't store target time, calculate it dynamically
            averageWageRatio: Math.round(averageWageRatio)
        })
            .where(eq(customers.id, customer.id));
        console.log(`Updated metrics for customer ${customer.name}: Efficiency ${averageEfficiency.toFixed(2)}%, Wage Ratio ${Math.round(averageWageRatio)}%`);
    }
    catch (error) {
        console.error(`Error calculating metrics for customer ${customerId}:`, error);
    }
}
// Calculate and update customer metrics (target time and average wage ratio)
router.post("/customers/calculate-metrics", async (req, res) => {
    try {
        // Fetch staff pay rate from settings
        const payRateRow = await db
            .select()
            .from(settings)
            .where(eq(settings.key, "staff_pay_rate_per_hour"))
            .limit(1);
        const staffPayRatePerHour = Number(payRateRow[0]?.value ?? 32.31);
        // Get all customers
        const allCustomers = await db
            .select({
            id: customers.id,
            name: customers.name,
            price: customers.price,
            isFriendsFamily: customers.isFriendsFamily
        })
            .from(customers);
        const updatedCustomers = [];
        for (const customer of allCustomers) {
            // Skip metrics calculation for friends & family customers
            if (customer.isFriendsFamily) {
                console.log(`Skipping metrics calculation for friends & family customer: ${customer.name}`);
                continue;
            }
            // Get all completed jobs for this customer
            const completedJobs = await db
                .select({
                jobId: jobs.id,
                price: customers.price,
                actualJobDuration: sql `
            EXTRACT(EPOCH FROM (
              MAX(${timeEntries.clockOutTime}) - MIN(${timeEntries.clockInTime})
            )) / 3600
          `,
                totalWages: sql `
            COALESCE(
              SUM(
                EXTRACT(EPOCH FROM (${timeEntries.clockOutTime} - ${timeEntries.clockInTime})) / 3600 * ${staffPayRatePerHour}
              ),
              0
            )
          `
            })
                .from(timeEntries)
                .innerJoin(jobs, eq(timeEntries.jobId, jobs.id))
                .innerJoin(customers, eq(jobs.customerId, customers.id))
                .where(and(eq(jobs.customerId, customer.id), sql `${timeEntries.clockOutTime} IS NOT NULL`))
                .groupBy(jobs.id, customers.price);
            if (completedJobs.length === 0) {
                // No completed jobs, set default values
                await db
                    .update(customers)
                    .set({
                    targetTimeMinutes: null,
                    averageWageRatio: null
                })
                    .where(eq(customers.id, customer.id));
                updatedCustomers.push({
                    id: customer.id,
                    name: customer.name,
                    targetTimeMinutes: null,
                    averageWageRatio: null,
                    completedJobs: 0
                });
                continue;
            }
            // Calculate metrics for each job
            let totalEfficiency = 0;
            let totalWageRatio = 0;
            let validJobs = 0;
            console.log(`\n=== CUSTOMER EFFICIENCY CALCULATION (${customer.name}) ===`);
            console.log(`Found ${completedJobs.length} completed jobs for this customer`);
            for (const job of completedJobs) {
                if (job.actualJobDuration > 0) {
                    // Get the expected time from price tiers based on customer price
                    const priceTier = await db
                        .select({
                        allottedMinutes: timeAllocationTiers.allottedMinutes
                    })
                        .from(timeAllocationTiers)
                        .where(and(sql `${timeAllocationTiers.priceMin} <= ${job.price}`, sql `${timeAllocationTiers.priceMax} >= ${job.price}`))
                        .limit(1);
                    let expectedTime = 1.5; // Default 1.5 hours (90 minutes) if no tier found
                    if (priceTier.length > 0) {
                        expectedTime = priceTier[0].allottedMinutes / 60; // Convert minutes to hours
                    }
                    // Calculate efficiency for this job
                    const jobEfficiency = (expectedTime / job.actualJobDuration) * 100;
                    const roundedEfficiency = Math.max(Math.round(jobEfficiency), 0);
                    totalEfficiency += roundedEfficiency;
                    // Calculate wage ratio for this job
                    const jobWageRatio = job.price > 0 ? Math.round((job.totalWages / job.price) * 100) : 0;
                    totalWageRatio += jobWageRatio;
                    console.log(`Job ${job.jobId}: Expected ${expectedTime}h, Actual ${Number(job.actualJobDuration).toFixed(2)}h, Efficiency ${roundedEfficiency}%`);
                    validJobs++;
                }
            }
            // Calculate averages
            const averageEfficiency = validJobs > 0 ? totalEfficiency / validJobs : 0;
            const averageWageRatio = validJobs > 0 ? totalWageRatio / validJobs : 0;
            console.log(`Customer ${customer.name}: Total efficiency ${totalEfficiency}, Valid jobs ${validJobs}, Average efficiency ${averageEfficiency.toFixed(2)}%`);
            console.log(`=== END CUSTOMER EFFICIENCY ===\n`);
            // Update customer with calculated metrics (only store wage ratio, target time is calculated dynamically)
            await db
                .update(customers)
                .set({
                targetTimeMinutes: null, // Don't store target time, calculate it dynamically
                averageWageRatio: Math.round(averageWageRatio)
            })
                .where(eq(customers.id, customer.id));
            updatedCustomers.push({
                id: customer.id,
                name: customer.name,
                targetTimeMinutes: null, // Will be calculated dynamically
                averageWageRatio: Math.round(averageWageRatio),
                completedJobs: validJobs
            });
        }
        res.json({
            success: true,
            data: {
                message: `Updated metrics for ${updatedCustomers.length} customers`,
                customers: updatedCustomers
            }
        });
    }
    catch (error) {
        console.error("Error calculating customer metrics:", error);
        res.status(500).json({ success: false, error: "Failed to calculate customer metrics" });
    }
});
export { calculateCustomerMetrics };
const connectedClients = new Map();
const MAX_CONNECTIONS = 100; // Limit concurrent connections
const HEARTBEAT_INTERVAL = 30000; // 30 seconds
// SSE endpoint for real-time dashboard updates
router.get("/dashboard/events", async (req, res) => {
    // Check connection limit
    if (connectedClients.size >= MAX_CONNECTIONS) {
        return res.status(503).json({
            success: false,
            error: "Too many concurrent connections"
        });
    }
    // Set headers for SSE
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control'
    });
    // Generate unique client ID
    const clientId = `${req.user?.id || 'anonymous'}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    // Create client object
    const client = {
        response: res,
        userId: req.user?.id || 0,
        connectedAt: new Date(),
        lastHeartbeat: new Date()
    };
    // Add this client to the map
    connectedClients.set(clientId, client);
    // Send initial connection message
    res.write(`data: ${JSON.stringify({
        type: 'connected',
        message: 'SSE connection established',
        clientId
    })}\n\n`);
    // Handle client disconnect
    const cleanup = () => {
        connectedClients.delete(clientId);
        console.log(`SSE client disconnected: ${clientId}. Active connections: ${connectedClients.size}`);
    };
    req.on('close', cleanup);
    req.on('error', cleanup);
    // Keep connection alive with heartbeat
    const heartbeat = setInterval(() => {
        if (res.writableEnded) {
            clearInterval(heartbeat);
            cleanup();
            return;
        }
        try {
            client.lastHeartbeat = new Date();
            res.write(`data: ${JSON.stringify({
                type: 'heartbeat',
                timestamp: Date.now()
            })}\n\n`);
        }
        catch (error) {
            console.error('Heartbeat failed for client:', clientId, error);
            clearInterval(heartbeat);
            cleanup();
        }
    }, HEARTBEAT_INTERVAL);
    // Clean up on disconnect
    req.on('close', () => {
        clearInterval(heartbeat);
        cleanup();
    });
    console.log(`SSE client connected: ${clientId}. Active connections: ${connectedClients.size}`);
});
// Function to broadcast dashboard updates to all connected clients
export const broadcastDashboardUpdate = (eventType, data) => {
    const message = JSON.stringify({ type: eventType, data, timestamp: Date.now() });
    let sentCount = 0;
    let errorCount = 0;
    // Clean up disconnected clients first
    for (const [clientId, client] of connectedClients.entries()) {
        if (client.response.writableEnded) {
            connectedClients.delete(clientId);
            continue;
        }
        try {
            client.response.write(`data: ${message}\n\n`);
            sentCount++;
        }
        catch (error) {
            console.error(`Failed to send to client ${clientId}:`, error);
            connectedClients.delete(clientId);
            errorCount++;
        }
    }
    if (sentCount > 0 || errorCount > 0) {
        console.log(`Broadcasted ${eventType} to ${sentCount} clients (${errorCount} errors). Active connections: ${connectedClients.size}`);
    }
};
// Periodic cleanup of stale connections
setInterval(() => {
    const now = new Date();
    let cleanedCount = 0;
    for (const [clientId, client] of connectedClients.entries()) {
        // Remove clients that haven't responded to heartbeat in 2 minutes
        const timeSinceHeartbeat = now.getTime() - client.lastHeartbeat.getTime();
        if (timeSinceHeartbeat > 120000) { // 2 minutes
            connectedClients.delete(clientId);
            cleanedCount++;
        }
    }
    if (cleanedCount > 0) {
        console.log(`Cleaned up ${cleanedCount} stale SSE connections. Active connections: ${connectedClients.size}`);
    }
}, 60000); // Check every minute
// === PAYROLL SETTINGS ===
// Get all payroll settings
router.get("/settings/payroll", async (req, res) => {
    try {
        const settingsKeys = [
            "staff_pay_rate_per_hour",
            "staff_start_time",
            "lunch_break_min_hours",
            "lunch_break_duration_minutes",
            "lunch_break_start_time",
            "lunch_break_finish_time"
        ];
        const settingsRows = await db
            .select()
            .from(settings)
            .where(inArray(settings.key, settingsKeys));
        const settingsMap = {};
        for (const row of settingsRows) {
            settingsMap[row.key] = row.value;
        }
        const responseData = {
            payRatePerHour: Number(settingsMap["staff_pay_rate_per_hour"] ?? 32.31),
            staffStartTime: settingsMap["staff_start_time"] ?? "08:00",
            lunchBreakMinHours: Number(settingsMap["lunch_break_min_hours"] ?? 5),
            lunchBreakDurationMinutes: Number(settingsMap["lunch_break_duration_minutes"] ?? 30),
            lunchBreakStartTime: settingsMap["lunch_break_start_time"] ?? "09:00",
            lunchBreakFinishTime: settingsMap["lunch_break_finish_time"] ?? "17:00"
        };
        res.json({ success: true, data: responseData });
    }
    catch (error) {
        console.error("Error fetching payroll settings:", error);
        res.status(500).json({ success: false, error: "Failed to fetch payroll settings" });
    }
});
// Update all payroll settings
router.put("/settings/payroll", async (req, res) => {
    try {
        const { payRatePerHour, staffStartTime, lunchBreakMinHours, lunchBreakDurationMinutes, lunchBreakStartTime, lunchBreakFinishTime } = req.body;
        const updates = [
            { key: "staff_pay_rate_per_hour", value: String(payRatePerHour ?? 32.31) },
            { key: "staff_start_time", value: staffStartTime ?? "08:00" },
            { key: "lunch_break_min_hours", value: String(lunchBreakMinHours ?? 5) },
            { key: "lunch_break_duration_minutes", value: String(lunchBreakDurationMinutes ?? 30) },
            { key: "lunch_break_start_time", value: lunchBreakStartTime ?? "09:00" },
            { key: "lunch_break_finish_time", value: lunchBreakFinishTime ?? "17:00" }
        ];
        for (const { key, value } of updates) {
            try {
                await db
                    .insert(settings)
                    .values({ key, value })
                    .onConflictDoUpdate({ target: settings.key, set: { value } });
            }
            catch (upsertError) {
                console.error(`[Payroll Settings] Upsert failed for ${key}:`, upsertError);
                throw upsertError;
            }
        }
        res.json({ success: true });
    }
    catch (error) {
        console.error("Error updating payroll settings:", error);
        res.status(500).json({ success: false, error: "Failed to update payroll settings", details: error instanceof Error ? error.message : error });
    }
});
export default router;
// Helper to safely parse JSON or return array/object as-is
function parseMaybeJson(val) {
    if (!val)
        return [];
    if (typeof val === 'string') {
        try {
            return JSON.parse(val);
        }
        catch {
            return [];
        }
    }
    if (Array.isArray(val))
        return val;
    return [];
}
// === CUSTOMER MANAGEMENT ===
