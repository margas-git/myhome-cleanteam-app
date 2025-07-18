# Staff Customer Creation Feature

## Overview
Staff members can now create new customers directly from their dashboard when they encounter a customer that hasn't been added to the system yet. This prevents staff from being unable to clock in when they arrive at a customer's location.

## Features

### Frontend Components
- **AddCustomerModal**: A modal component that allows staff to input customer details
- **Form Validation**: Ensures all required fields are filled
- **Address Geocoding**: Automatically converts addresses to coordinates using Google Maps API
- **Price Tier Selection**: Staff can select from existing price tiers
- **Real-time Updates**: New customers appear in the nearby customers list immediately

### Backend API
- **POST /staff/customers**: Creates a new customer with staff member tracking
- **Database Schema**: Added `createdByUserId` field to track who created each customer
- **Validation**: Ensures all required fields are provided
- **Audit Trail**: Logs which staff member created each customer

## Database Migration

To apply the database changes, run:

```bash
# Set your DATABASE_URL environment variable
export DATABASE_URL="your_database_connection_string"

# Run the migration script
node apply-customer-created-by-migration.js
```

## Usage

1. **Staff Dashboard**: Staff will see an "Add Customer" button in the header of the Nearby Customers section
2. **Customer Creation**: Click the button to open the customer creation modal
3. **Fill Details**: Enter customer name, address, contact info, and select a price tier
4. **Automatic Geocoding**: The system will automatically find coordinates for the address
5. **Success**: The new customer will appear in the nearby customers list and can be used for clock-in

**Note**: The "Add Customer" button is always available, allowing staff to add new customers even when existing customers are nearby. This is useful for adding customers in the same building, apartment block, or street.

## Required Fields
- **Name**: Customer's name (required)
- **Address**: Full address (required)
- **Price**: Select from existing price tiers (required)
- **Phone**: Optional contact number
- **Email**: Optional email address
- **Notes**: Optional additional information

## Security
- Only authenticated staff members can create customers
- All customer creations are logged with the staff member's ID
- Address validation ensures coordinates are found before creation
- Form validation prevents invalid data submission

## Technical Details

### Database Schema Changes
```sql
ALTER TABLE customers ADD COLUMN created_by_user_id INTEGER REFERENCES users(id);
CREATE INDEX idx_customers_created_by_user_id ON customers(created_by_user_id);
```

### API Endpoint
```typescript
POST /staff/customers
{
  name: string,
  address: string,
  phone?: string,
  email?: string,
  price: number,
  notes?: string,
  latitude: string,
  longitude: string
}
```

### Component Props
```typescript
interface AddCustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}
```

## Error Handling
- **Geocoding Failures**: If address cannot be geocoded, user is prompted to check the address
- **Network Errors**: Graceful error messages for API failures
- **Validation Errors**: Clear feedback for missing required fields
- **Database Errors**: Proper error logging and user feedback

## Future Enhancements
- Customer photo upload
- Address autocomplete suggestions
- Bulk customer import
- Customer template creation
- Integration with external address validation services 