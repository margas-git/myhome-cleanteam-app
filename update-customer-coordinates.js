const { Client } = require('pg');
require('dotenv').config();

// Google Maps Geocoding function
async function geocodeAddress(address) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    console.error('❌ GOOGLE_MAPS_API_KEY not found in environment variables');
    return null;
  }

  try {
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address + ', Australia')}&key=${apiKey}`
    );
    
    const data = await response.json();
    
    if (data.status === 'OK' && data.results[0]) {
      const location = data.results[0].geometry.location;
      return {
        latitude: location.lat.toString(),
        longitude: location.lng.toString()
      };
    } else {
      console.error(`❌ Geocoding failed for "${address}": ${data.status}`);
      return null;
    }
  } catch (error) {
    console.error(`❌ Error geocoding "${address}":`, error.message);
    return null;
  }
}

async function updateCustomerCoordinates() {
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'myhomecleanteam',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'password'
  });

  try {
    await client.connect();
    console.log('✅ Connected to database');

    // Get all customers with default coordinates
    const result = await client.query(`
      SELECT id, name, address, latitude, longitude 
      FROM customers 
      WHERE latitude = '-37.8136' AND longitude = '144.9631'
    `);

    console.log(`📊 Found ${result.rows.length} customers with default coordinates`);

    if (result.rows.length === 0) {
      console.log('✅ All customers already have real coordinates!');
      return;
    }

    let updatedCount = 0;
    let failedCount = 0;

    for (const customer of result.rows) {
      console.log(`\n🔄 Processing: ${customer.name} - ${customer.address}`);
      
      const coordinates = await geocodeAddress(customer.address);
      
      if (coordinates) {
        await client.query(
          'UPDATE customers SET latitude = $1, longitude = $2 WHERE id = $3',
          [coordinates.latitude, coordinates.longitude, customer.id]
        );
        
        console.log(`✅ Updated ${customer.name}: ${coordinates.latitude}, ${coordinates.longitude}`);
        updatedCount++;
        
        // Add a small delay to avoid hitting API rate limits
        await new Promise(resolve => setTimeout(resolve, 200));
      } else {
        console.log(`❌ Failed to geocode ${customer.name}`);
        failedCount++;
      }
    }

    console.log(`\n📈 Summary:`);
    console.log(`✅ Successfully updated: ${updatedCount} customers`);
    console.log(`❌ Failed to update: ${failedCount} customers`);

  } catch (error) {
    console.error('❌ Database error:', error);
  } finally {
    await client.end();
    console.log('✅ Database connection closed');
  }
}

// Run the script
updateCustomerCoordinates().catch(console.error); 