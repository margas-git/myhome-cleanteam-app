# MyHome CleanTeam – Team Membership Tracker

This directory contains the workflow for tracking team membership periods based on the master spreadsheet.

## Files

- **MyHome Wages Macros.xlsm**: The master Excel file containing all team, date, and team ID data (column M).
- **fix_overlaps_and_gaps.py**: The script to process the spreadsheet and generate a clean, non-overlapping, gap-free team membership tracker.
- **team_id_tracker.csv**: The output CSV file with columns: `team_id`, `name`, `start_date`, `end_date`.

## Usage

1. **Update the spreadsheet** (`MyHome Wages Macros.xlsm`) with the latest team and team ID data. Ensure column M contains the correct Team ID for each row.
2. **Run the script:**
   ```bash
   python3 fix_overlaps_and_gaps.py
   ```
3. **Result:**
   - The script will output `team_id_tracker.csv` in this directory.
   - This CSV contains one row per unique team membership period, with no overlapping dates and no gaps for each team.

## Output Format

| team_id | name                              | start_date  | end_date    |
|---------|-----------------------------------|-------------|-------------|
| 1       | Orla Shelly & Julie Roccati       | 02/12/2024  | 04/12/2024  |
| ...     | ...                               | ...         | ...         |

- **team_id**: The team identifier from column M of the spreadsheet
- **name**: The team composition (from column B)
- **start_date, end_date**: The inclusive date range for this team composition

## Notes
- Only the files listed above are required for this workflow.
- All other scripts and outputs have been removed for clarity and simplicity.
- If you update the spreadsheet, simply rerun the script to regenerate the tracker.
