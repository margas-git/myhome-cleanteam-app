import { pgTable, serial, integer, varchar, text, timestamp, boolean, pgEnum, date, time, decimal, json, uniqueIndex } from "drizzle-orm/pg-core";
export const roleEnum = pgEnum("role", ["staff", "manager", "admin"]);
export const jobStatusEnum = pgEnum("job_status", ["scheduled", "in_progress", "completed"]);
export const users = pgTable("users", {
    id: serial("id").primaryKey(),
    email: varchar("email", { length: 255 }).notNull().unique(),
    passwordHash: varchar("password_hash", { length: 255 }).notNull(),
    firstName: varchar("first_name", { length: 100 }).notNull(),
    lastName: varchar("last_name", { length: 100 }).notNull(),
    phone: varchar("phone", { length: 32 }),
    role: roleEnum("role").notNull().default("staff"),
    active: boolean("active").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
});
export const teams = pgTable("teams", {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 100 }).notNull(),
    colorHex: varchar("color_hex", { length: 7 }).notNull(),
    active: boolean("active").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
});
export const teamsUsers = pgTable("teams_users", {
    teamId: integer("team_id").notNull().references(() => teams.id, { onDelete: "cascade" }),
    userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" })
}, (table) => {
    return {
        pk: uniqueIndex("teams_users_pk_idx").on(table.teamId, table.userId)
    };
});
export const cleanFrequencyEnum = pgEnum("clean_frequency", ["weekly", "fortnightly", "tri-weekly", "monthly", "one-off"]);
export const customers = pgTable("customers", {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    address: text("address").notNull(),
    latitude: varchar("latitude", { length: 64 }).notNull(),
    longitude: varchar("longitude", { length: 64 }).notNull(),
    phone: varchar("phone", { length: 32 }),
    email: varchar("email", { length: 255 }),
    price: integer("price").notNull(), // Changed to integer to remove decimals
    cleanFrequency: cleanFrequencyEnum("clean_frequency").default("weekly").notNull(),
    notes: text("notes"),
    targetTimeMinutes: integer("target_time_minutes"), // Target time in minutes for this customer
    averageWageRatio: integer("average_wage_ratio"), // Average wage ratio percentage for this customer
    isFriendsFamily: boolean("is_friends_family").default(false), // Whether this is a friends & family customer
    friendsFamilyMinutes: integer("friends_family_minutes"), // Allocated minutes for friends & family customers
    active: boolean("active").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
});
export const jobs = pgTable("jobs", {
    id: serial("id").primaryKey(),
    customerId: integer("customer_id").references(() => customers.id, { onDelete: "restrict" }),
    teamId: integer("team_id").references(() => teams.id, { onDelete: "set null" }),
    scheduledDate: date("scheduled_date"),
    startTime: time("start_time"),
    endTime: time("end_time"),
    status: jobStatusEnum("status").default("scheduled").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
});
export const timeEntries = pgTable("time_entries", {
    id: serial("id").primaryKey(),
    userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
    jobId: integer("job_id").references(() => jobs.id, { onDelete: "cascade" }).notNull(),
    clockInTime: timestamp("clock_in_time", { withTimezone: true }),
    clockOutTime: timestamp("clock_out_time", { withTimezone: true }),
    lunchBreak: boolean("lunch_break").default(false),
    geofenceOverride: boolean("geofence_override").default(false),
    autoLunchDeducted: boolean("auto_lunch_deducted").default(false)
});
export const settings = pgTable("settings", {
    key: varchar("key", { length: 128 }).primaryKey(),
    value: text("value").notNull()
});
export const timeAllocationTiers = pgTable("time_allocation_tiers", {
    id: serial("id").primaryKey(),
    priceMin: decimal("price_min", { precision: 10, scale: 2 }).notNull(),
    priceMax: decimal("price_max", { precision: 10, scale: 2 }).notNull(),
    allottedMinutes: integer("allotted_minutes").notNull()
});
export const sessions = pgTable("sessions", {
    sid: varchar("sid", { length: 255 }).primaryKey(),
    userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
    sessionData: json("session_data"),
    expires: timestamp("expires", { withTimezone: true })
});
export const lunchBreakOverrides = pgTable("lunch_break_overrides", {
    id: serial("id").primaryKey(),
    userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
    date: date("date").notNull(),
    hasLunchBreak: boolean("has_lunch_break").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
}, (table) => {
    return {
        userDateUnique: uniqueIndex("lunch_break_overrides_user_date_idx").on(table.userId, table.date)
    };
});
