-- Add createdByUserId field to customers table
ALTER TABLE customers ADD COLUMN created_by_user_id INTEGER REFERENCES users(id);

-- Add an index for better query performance
CREATE INDEX idx_customers_created_by_user_id ON customers(created_by_user_id); 