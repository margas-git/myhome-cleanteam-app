# Historical Cleans Import Guide

This guide explains how to import historical cleaning data into the MyHome CleanTeam system.

## Overview

The system allows you to import historical cleaning jobs and their corresponding time entries to populate your database with past cleaning activities. This is useful for:

- Historical reporting and analytics
- Calculating customer efficiency metrics
- Understanding cleaning patterns and trends
- Setting up baseline data for new customers

## Prerequisites

1. **Database Setup**: Ensure your database is set up and running
2. **Customer Data**: All customers should be imported first (use `reset-and-import.js`)
3. **User Data**: All staff users should be created
4. **Team Data**: Teams should be configured

## Step-by-Step Process

### Step 1: Generate the Template

Run the template generation script to create an Excel file with all the necessary reference data:

```bash
npx tsx generate-import-template.js
```

This will create two files:
- `historical-cleans-template.xlsx`: Basic template
- `historical-cleans-template-enhanced.xlsx`: **RECOMMENDED** - Enhanced template with VLOOKUP formulas

### Step 2: Prepare Your Data

**Use the enhanced template** (`historical-cleans-template-enhanced.xlsx`) for easier data entry:

1. **Open the enhanced template**: Open `historical-cleans-template-enhanced.xlsx` in Excel

2. **Fill out the jobs sheet** with your historical cleaning jobs:
   - `customer_name`: Enter customer name (VLOOKUP will auto-populate customer_id)
   - `team_name`: Enter team name (VLOOKUP will auto-populate team_id)
   - `scheduled_date`: Date in YYYY-MM-DD format (e.g., 2024-01-15)
   - `start_time`: Time in HH:MM format (e.g., 09:00)
   - `end_time`: Time in HH:MM format (e.g., 11:30)
   - `status`: Use "completed" for historical data

3. **Fill out the time_entries sheet** with the corresponding time entries:
   - `customer_name`: Enter customer name (must match jobs sheet)
   - `scheduled_date`: Enter scheduled date (must match jobs sheet)
   - `user_name`: Enter user name (VLOOKUP will auto-populate user_id)
   - `clock_in_time`: Full timestamp in YYYY-MM-DD HH:MM:SS format
   - `clock_out_time`: Full timestamp in YYYY-MM-DD HH:MM:SS format
   - `lunch_break`: true/false
   - `geofence_override`: true/false (usually false for historical data)
   - `auto_lunch_deducted`: true/false

### Step 3: Import the Data

1. **Save your file**: Save the completed Excel file as `historical-cleans.xlsx` in the project root

2. **Run the import script**:
   ```bash
   npx tsx import-historical-cleans.js
   ```

## Data Format Examples

### Jobs Sheet Example:
| customer_name | customer_id | team_name | team_id | scheduled_date | start_time | end_time | status    |
|---------------|-------------|-----------|---------|----------------|------------|----------|-----------|
| Abby Morphett-Persson | =VLOOKUP(A2,customers_reference!A:C,1,FALSE) | Cleaning Team A | =VLOOKUP(C2,teams_reference!A:B,1,FALSE) | 2024-01-15 | 09:00 | 11:30 | completed |
| Aden J Margheriti | =VLOOKUP(A3,customers_reference!A:C,1,FALSE) | Cleaning Team B | =VLOOKUP(C3,teams_reference!A:B,1,FALSE) | 2024-01-16 | 10:00 | 12:00 | completed |

### Time Entries Sheet Example:
| customer_name | customer_id | scheduled_date | user_name | user_id | clock_in_time | clock_out_time | lunch_break | geofence_override | auto_lunch_deducted |
|---------------|-------------|----------------|-----------|---------|---------------|----------------|-------------|------------------|-------------------|
| Abby Morphett-Persson | =VLOOKUP(A2,customers_reference!A:C,1,FALSE) | 2024-01-15 | Test User | =VLOOKUP(D2,users_reference!A:B,1,FALSE) | 2024-01-15 09:00:00 | 2024-01-15 11:30:00 | false | false | false |

## Enhanced Template Features

### VLOOKUP Formulas
The enhanced template includes automatic VLOOKUP formulas that:
- **Auto-populate customer IDs** when you enter customer names
- **Auto-populate team IDs** when you enter team names  
- **Auto-populate user IDs** when you enter user names
- **Reduce data entry errors** by eliminating manual ID lookup

### Data Validation
- **Dropdown lists** for customer names, team names, and user names
- **Date format validation** for scheduled dates and timestamps
- **Automatic error checking** for missing required fields

### Matching Logic
The import script matches time entries to jobs using:
1. **Customer name** and **scheduled date** combination
2. **Automatic ID resolution** from names to database IDs
3. **Flexible input** - accepts both names and IDs

## Important Notes

### Data Validation
- All required fields must be filled
- Dates must be in the correct format
- Customer and user names must exist in the database
- Time entries must have valid clock-in and clock-out times

### VLOOKUP Benefits
- **Faster data entry**: Just type names instead of looking up IDs
- **Fewer errors**: No manual ID entry required
- **Automatic validation**: Invalid names will show errors
- **Consistent data**: Names are standardized across sheets

### Error Handling
- The script will skip invalid entries and continue processing
- A summary of successful imports and errors will be displayed
- Check the console output for any issues

## Troubleshooting

### Common Issues

1. **"Customer not found" errors**
   - Verify customer names match exactly (case-sensitive)
   - Check the customers_reference sheet for exact names
   - Ensure customers exist in the database

2. **"User not found" errors**
   - Verify user names match exactly (case-sensitive)
   - Check the users_reference sheet for exact names
   - Ensure users exist in the database

3. **VLOOKUP formula errors**
   - Make sure you're using the enhanced template
   - Check that reference sheets are present
   - Verify Excel formulas are enabled

4. **Date format errors**
   - Use YYYY-MM-DD format for dates
   - Use HH:MM format for times
   - Use YYYY-MM-DD HH:MM:SS format for timestamps

5. **Missing required fields**
   - Ensure all required fields are filled
   - Check that VLOOKUP formulas are working correctly

### Getting Help

If you encounter issues:
1. Check the console output for specific error messages
2. Verify your data format matches the examples
3. Ensure all referenced names exist in the database
4. Check that the Excel file is saved as `historical-cleans.xlsx`
5. Try using the enhanced template with VLOOKUP formulas

## Post-Import Verification

After importing, you can verify the data by:

1. **Check the admin dashboard** for the imported jobs
2. **Review customer efficiency metrics** which should now be calculated
3. **Check staff time entries** in the staff dashboard
4. **Run reports** to see the historical data

## Files Created

- `historical-cleans-template.xlsx`: Basic template
- `historical-cleans-template-enhanced.xlsx`: **RECOMMENDED** - Enhanced template with VLOOKUP formulas
- `generate-import-template.js`: Script to generate the templates
- `import-historical-cleans.js`: Script to import the data
- `HISTORICAL_CLEANS_IMPORT.md`: This guide 