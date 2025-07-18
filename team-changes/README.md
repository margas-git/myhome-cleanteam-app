# Team Membership Tracker (team-changes)

This directory contains the workflow for generating a clean, non-overlapping, gap-free team membership tracker from the master spreadsheet, with individual staff member tracking.

## Files

- **MyHome Wages Macros.xlsm**: The master Excel file containing all team, date, and team ID data (column M).
- **team_id_tracker_dynamic.py**: The script to process the spreadsheet and generate the tracker.
- **team_id_tracker.csv**: The output CSV file with columns: `team_id`, `name`, `original_team`, `start_date`, `end_date`.

## Usage

1. **Update the spreadsheet** (`MyHome Wages Macros.xlsm`) with the latest team and team ID data. Ensure column M contains the correct Team ID for each row.
2. **Run the script:**
   ```bash
   python3 team_id_tracker_dynamic.py
   ```
3. **Result:**
   - The script will output `team_id_tracker.csv` in this directory.
   - This CSV contains one row per individual staff member per team membership period.

## Sheet Exclusions

The script will automatically exclude the following sheets from the import:
- `Totals`
- `Parameters`
- `Active Jobs`
- `17 May 25`
- `23 May 25`
- `30 May 25`
- `25 April 25`
- `6 June 25`
- `9 May 25`

All other sheets will be processed.

## Output Format

| team_id | name         | original_team                    | start_date  | end_date    |
|---------|--------------|----------------------------------|-------------|-------------|
| 1       | Orla Shelly  | Orla Shelly & Julie Roccati      | 02/12/2024  | 04/12/2024  |
| 1       | Julie Roccati| Orla Shelly & Julie Roccati      | 02/12/2024  | 04/12/2024  |
| ...     | ...          | ...                              | ...         | ...         |

- **team_id**: The team identifier from column M of the spreadsheet
- **name**: Individual staff member name
- **original_team**: The full team composition (from column B)
- **start_date, end_date**: The inclusive date range for this team membership

## Key Features

- **Individual Staff Tracking**: Each staff member gets their own row while preserving team context
- **Gap Handling**: Consecutive periods with the same team composition are grouped together, allowing for gaps (e.g., weekends)
- **Team Context**: The `original_team` column shows the full team composition for context
- **Excluded Sheets**: Specific sheets are excluded to avoid unwanted data
- **Date Format**: All dates are in DD/MM/YYYY format

## Data Processing Logic

1. **Extraction**: Reads team data from column B (Team) and column M (Team ID) from all non-excluded sheets
2. **Grouping**: Groups consecutive dates with the same team composition, allowing for gaps
3. **Splitting**: Splits team compositions into individual staff members (e.g., "Orla Shelly & Julie Roccati" becomes two separate rows)
4. **Output**: Generates CSV with individual staff member periods

## Notes

- Only the files listed above are required for this workflow.
- The script handles various date formats and validates Team ID values
- If you update the spreadsheet, simply rerun the script to regenerate the tracker
- The output maintains the same date ranges for all members of a team
- Invalid Team IDs (non-integer values) are automatically filtered out 