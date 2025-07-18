# Team Temporal Membership Guide

This guide explains how to handle team membership changes over time and how this affects historical data import.

## Problem Statement

In a cleaning business, team composition changes frequently due to:
- Staff turnover
- Seasonal workers
- Team reassignments
- Part-time vs full-time staff changes

**Example Scenario:**
- Team 3 in January: Staff A and Staff B
- Team 3 in March: Staff C and Staff D (after turnover)
- Historical data needs to reflect who was actually on the team when the work was done

## Solution: Temporal Team Membership

### Database Changes

We've added temporal fields to the `teams_users` table:

```sql
ALTER TABLE teams_users 
ADD COLUMN start_date DATE NOT NULL DEFAULT CURRENT_DATE,
ADD COLUMN end_date DATE;
```

### Key Concepts

1. **Start Date**: When someone joined the team
2. **End Date**: When someone left the team (NULL = currently active)
3. **Point-in-time queries**: Get team members at any specific date
4. **Historical accuracy**: Ensure time entries match actual team composition

## How It Works

### Current Team Members
```javascript
// Get who is on Team 1 right now
const currentMembers = await getCurrentTeamMembers(1);
```

### Historical Team Members
```javascript
// Get who was on Team 1 on March 15, 2024
const historicalMembers = await getTeamMembersAtDate(1, new Date('2024-03-15'));
```

### Adding/Removing Team Members
```javascript
// Add someone to a team
await addUserToTeam(userId, teamId, startDate);

// Remove someone from a team
await removeUserFromTeam(userId, teamId, endDate);
```

## Import Process for Historical Data

### Step 1: Set Up Team History

Before importing historical cleans, you need to establish team membership history:

1. **Create team membership records** for the time period you're importing
2. **Set start/end dates** for each team member
3. **Ensure coverage** for all dates in your historical data

### Step 2: Import with Validation

The import script now includes validation:

```javascript
// Verify user was on the team at the time of the job
const teamMembersAtDate = await getTeamMembersAtDate(teamId, scheduledDate);
const userWasOnTeam = teamMembersAtDate.some(member => member.userId === userId);

if (!userWasOnTeam) {
  console.log(`⚠️  User ${userName} was not on team ${teamId} on ${scheduledDate}`);
}
```

### Step 3: Handle Discrepancies

If the import finds users who weren't on the team at that time:

1. **Check team history** - maybe the user was on the team but records are missing
2. **Update team membership** - add the missing membership record
3. **Re-run import** - or manually adjust the data

## Best Practices

### 1. Team Membership Management

**When adding someone to a team:**
```javascript
await addUserToTeam(userId, teamId, new Date('2024-01-15'));
```

**When removing someone from a team:**
```javascript
await removeUserFromTeam(userId, teamId, new Date('2024-03-20'));
```

### 2. Historical Data Preparation

**Before importing historical cleans:**

1. **Audit team history** - ensure you have complete records
2. **Fill gaps** - add missing team membership records
3. **Validate data** - check that all users in historical data were on teams

### 3. Data Validation

**The import script will warn you about:**
- Users not on teams at the time of the job
- Missing team membership records
- Inconsistent team assignments

## Example Workflow

### Scenario: Importing January 2024 Data

1. **Check team composition for January 2024:**
   ```javascript
   const janTeam1 = await getTeamMembersAtDate(1, new Date('2024-01-15'));
   console.log('Team 1 members in January:', janTeam1);
   ```

2. **If team history is incomplete:**
   ```javascript
   // Add missing team members
   await addUserToTeam(userId, 1, new Date('2024-01-01'));
   ```

3. **Import historical data:**
   ```bash
   npx tsx import-historical-cleans.js
   ```

4. **Review warnings** and fix any team membership issues

## Migration Strategy

### For Existing Data

1. **Run the migration:**
   ```bash
   # Apply the database migration
   npm run db:push
   ```

2. **Set up current team memberships:**
   ```javascript
   // For existing team assignments, set start_date to a reasonable date
   // and end_date to NULL (currently active)
   ```

3. **Add historical team memberships** as needed for your import

### For New Data

1. **Always use temporal functions** when managing team membership
2. **Set proper start/end dates** when adding/removing team members
3. **Validate team composition** before importing historical data

## Troubleshooting

### Common Issues

1. **"User was not on team" warnings**
   - Check team membership history
   - Add missing membership records
   - Verify dates are correct

2. **Missing team members**
   - Ensure all team members have proper start/end dates
   - Check for overlapping memberships
   - Verify date formats

3. **Import errors**
   - Check that all referenced users exist
   - Verify team IDs are correct
   - Ensure date formats are consistent

### Getting Help

If you encounter issues:
1. Check the console output for specific error messages
2. Verify team membership records are complete
3. Use the utility functions to debug team composition
4. Check that all dates are in the correct format

## Files Modified

- `server/db/schema.ts`: Added temporal fields to teamsUsers table
- `database/0002_add_team_temporal_fields.sql`: Database migration
- `server/utils/teamUtils.ts`: Utility functions for temporal queries
- `import-historical-cleans.js`: Updated to validate team membership
- `TEAM_TEMPORAL_GUIDE.md`: This guide

## Next Steps

1. **Run the database migration** to add temporal fields
2. **Set up current team memberships** with proper start dates
3. **Prepare historical team data** for your import period
4. **Import historical cleans** with the enhanced validation
5. **Review and fix** any team membership discrepancies 