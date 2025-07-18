const { Pool } = require('pg');
const axios = require('axios');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;

async function geocodeAddress(address) {
  try {
    const response = await axios.get('https://maps.googleapis.com/maps/api/geocode/json', {
      params: {
        address: address,
        key: GOOGLE_MAPS_API_KEY
      }
    });

    if (response.data.results && response.data.results.length > 0) {
      const location = response.data.results[0].geometry.location;
      return {
        lat: location.lat,
        lng: location.lng
      };
    }
    return null;
  } catch (error) {
    console.error(`Error geocoding address "${address}":`, error.message);
    return null;
  }
}

async function updateCustomerCoordinates() {
  try {
    // Get all customers with addresses
    const result = await pool.query(`
      SELECT id, address 
      FROM customers 
      WHERE address IS NOT NULL AND address != ''
      ORDER BY id
    `);

    console.log(`Found ${result.rows.length} customers to update`);

    for (const customer of result.rows) {
      console.log(`Processing customer ${customer.id}: ${customer.address}`);
      
      const coordinates = await geocodeAddress(customer.address);
      
      if (coordinates) {
        await pool.query(`
          UPDATE customers 
          SET latitude = $1, longitude = $2 
          WHERE id = $3
        `, [coordinates.lat.toString(), coordinates.lng.toString(), customer.id]);
        
        console.log(`✅ Updated customer ${customer.id} with coordinates: ${coordinates.lat}, ${coordinates.lng}`);
      } else {
        console.log(`❌ Could not geocode address for customer ${customer.id}`);
      }
      
      // Add a small delay to avoid hitting API rate limits
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    console.log('✅ Customer coordinates update completed');
  } catch (error) {
    console.error('Error updating customer coordinates:', error);
  } finally {
    await pool.end();
  }
}

updateCustomerCoordinates(); 