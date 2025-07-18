#!/usr/bin/env python3
"""
Fix overlapping dates and gaps in team assignments
Based on the specific issues identified:
- Green lines represent overlapping dates that need to be split
- Blue lines represent gaps that need to be filled
"""

import csv
from datetime import datetime, date

def parse_date(date_str):
    """Parse date in DD/MM/YYYY format"""
    return datetime.strptime(date_str, '%d/%m/%Y').date()

def format_date(date_obj):
    """Format date as DD/MM/YYYY"""
    return date_obj.strftime('%d/%m/%Y')

def fix_overlaps_and_gaps():
    """Fix the specific overlapping and gap issues"""
    
    # Start with the current problematic data
    current_data = [
        {'team_id': '1', 'name': 'Orla Shelly & Julie Roccati', 'start_date': '02/12/2024', 'end_date': '04/12/2024'},
        {'team_id': '1', 'name': 'Orla Shelly & Tia', 'start_date': '05/12/2024', 'end_date': '13/12/2024'},
        {'team_id': '1', 'name': 'Orla Shelly & Sheyda', 'start_date': '11/12/2024', 'end_date': '11/12/2024'},
        {'team_id': '1', 'name': 'Tia', 'start_date': '16/12/2024', 'end_date': '23/12/2024'},
        {'team_id': '1', 'name': 'Aoife O\'Gorman & Aoife Carroll', 'start_date': '07/01/2025', 'end_date': '17/01/2025'},
        {'team_id': '1', 'name': 'Aoife O\'Gorman & Aoife Carroll & Orla Shelly', 'start_date': '10/01/2025', 'end_date': '10/01/2025'},
        {'team_id': '2', 'name': 'Julie Roccati & Sheyda', 'start_date': '05/12/2024', 'end_date': '03/01/2025'},
        {'team_id': '2', 'name': 'Sheyda', 'start_date': '06/01/2025', 'end_date': '06/01/2025'},
        {'team_id': '2', 'name': 'Julie Roccati & Sheyda & Orla Shelly', 'start_date': '13/01/2025', 'end_date': '03/01/2025'},
        {'team_id': '2', 'name': 'Orla Shelly & Julie Roccati', 'start_date': '14/01/2025', 'end_date': '17/01/2025'},
    ]
    
    # Convert to date objects
    for entry in current_data:
        entry['start_date'] = parse_date(entry['start_date'])
        entry['end_date'] = parse_date(entry['end_date'])
    
    # Fix the specific issues:
    
    # 1. Team ID 1 - Orla Shelly & Tia overlaps with Orla Shelly & Sheyda on 11/12/2024
    # Split Orla Shelly & Tia into two periods: 05/12/2024 to 10/12/2024 and 12/12/2024 to 13/12/2024
    
    # 2. Team ID 1 - Tia overlaps with Orla Shelly & Tia on 16/12/2024 to 23/12/2024
    # This should be handled by creating separate entries
    
    # 3. Team ID 2 - Gap between Sheyda ending 06/01/2025 and Julie Roccati & Sheyda & Orla Shelly starting 13/01/2025
    # Need to fill the gap from 07/01/2025 to 12/01/2025
    
    fixed_data = []
    
    # Team ID 1 fixes
    # Orla Shelly & Julie Roccati (02/12/2024 to 04/12/2024) - no change
    fixed_data.append({
        'team_id': '1',
        'name': 'Orla Shelly & Julie Roccati',
        'start_date': date(2024, 12, 2),
        'end_date': date(2024, 12, 4)
    })
    
    # Orla Shelly & Tia - split due to overlap with Orla Shelly & Sheyda on 11/12/2024
    fixed_data.append({
        'team_id': '1',
        'name': 'Orla Shelly & Tia',
        'start_date': date(2024, 12, 5),
        'end_date': date(2024, 12, 10)
    })
    
    # Orla Shelly & Sheyda (11/12/2024) - no change
    fixed_data.append({
        'team_id': '1',
        'name': 'Orla Shelly & Sheyda',
        'start_date': date(2024, 12, 11),
        'end_date': date(2024, 12, 11)
    })
    
    # Orla Shelly & Tia - second period after Sheyda
    fixed_data.append({
        'team_id': '1',
        'name': 'Orla Shelly & Tia',
        'start_date': date(2024, 12, 12),
        'end_date': date(2024, 12, 13)
    })
    
    # Tia (16/12/2024 to 23/12/2024) - no change
    fixed_data.append({
        'team_id': '1',
        'name': 'Tia',
        'start_date': date(2024, 12, 16),
        'end_date': date(2024, 12, 23)
    })
    
    # Aoife O'Gorman & Aoife Carroll - split into two periods
    # First period: 07/01/2025 to 09/01/2025
    fixed_data.append({
        'team_id': '1',
        'name': 'Aoife O\'Gorman & Aoife Carroll',
        'start_date': date(2025, 1, 7),
        'end_date': date(2025, 1, 9)
    })
    
    # Aoife O'Gorman & Aoife Carroll & Orla Shelly (10/01/2025) - no change
    fixed_data.append({
        'team_id': '1',
        'name': 'Aoife O\'Gorman & Aoife Carroll & Orla Shelly',
        'start_date': date(2025, 1, 10),
        'end_date': date(2025, 1, 10)
    })
    
    # Aoife O'Gorman & Aoife Carroll - second period: 11/01/2025 to 17/01/2025
    fixed_data.append({
        'team_id': '1',
        'name': 'Aoife O\'Gorman & Aoife Carroll',
        'start_date': date(2025, 1, 11),
        'end_date': date(2025, 1, 17)
    })
    
    # Team ID 2 fixes
    # Julie Roccati & Sheyda (05/12/2024 to 03/01/2025) - no change
    fixed_data.append({
        'team_id': '2',
        'name': 'Julie Roccati & Sheyda',
        'start_date': date(2024, 12, 5),
        'end_date': date(2025, 1, 3)
    })
    
    # Sheyda (06/01/2025) - no change
    fixed_data.append({
        'team_id': '2',
        'name': 'Sheyda',
        'start_date': date(2025, 1, 6),
        'end_date': date(2025, 1, 6)
    })
    
    # Julie Roccati & Sheyda (07/01/2025 to 12/01/2025) - changed from just Sheyda
    fixed_data.append({
        'team_id': '2',
        'name': 'Julie Roccati & Sheyda',
        'start_date': date(2025, 1, 7),
        'end_date': date(2025, 1, 12)
    })
    
    # Julie Roccati & Sheyda & Orla Shelly (13/01/2025) - fix end date
    fixed_data.append({
        'team_id': '2',
        'name': 'Julie Roccati & Sheyda & Orla Shelly',
        'start_date': date(2025, 1, 13),
        'end_date': date(2025, 1, 13)  # Fix: should end on 13/01/2025, not 03/01/2025
    })
    
    # Orla Shelly & Julie Roccati (14/01/2025 to 17/01/2025) - no change
    fixed_data.append({
        'team_id': '2',
        'name': 'Orla Shelly & Julie Roccati',
        'start_date': date(2025, 1, 14),
        'end_date': date(2025, 1, 17)
    })
    
    # Sort by team_id and start_date
    fixed_data.sort(key=lambda x: (x['team_id'], x['start_date']))
    
    return fixed_data

def save_to_csv(data, filename='team_id_periods_fixed_final.csv'):
    """Save the fixed data to CSV"""
    with open(filename, 'w', newline='', encoding='utf-8') as csvfile:
        fieldnames = ['team_id', 'name', 'start_date', 'end_date']
        writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
        
        writer.writeheader()
        for entry in data:
            writer.writerow({
                'team_id': entry['team_id'],
                'name': entry['name'],
                'start_date': format_date(entry['start_date']),
                'end_date': format_date(entry['end_date'])
            })
    
    print(f"Fixed data saved to {filename}")

def main():
    """Main function"""
    print("Fixing overlapping dates and gaps...")
    print("-" * 40)
    
    # Get the fixed data
    fixed_data = fix_overlaps_and_gaps()
    
    # Save to CSV
    save_to_csv(fixed_data)
    
    # Print summary
    print(f"\n{'='*40}")
    print(f"FIXED TEAM ID CSV GENERATED!")
    print(f"{'='*40}")
    print(f"Total team periods: {len(fixed_data)}")
    
    # Show the fixed data
    print(f"\nFixed data:")
    for i, entry in enumerate(fixed_data, 1):
        start_date_str = format_date(entry['start_date'])
        end_date_str = format_date(entry['end_date'])
        print(f"  {i}. Team ID: {entry['team_id']}, Name: '{entry['name']}', Period: {start_date_str} to {end_date_str}")

if __name__ == "__main__":
    main() 