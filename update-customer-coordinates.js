import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { db } from "./server/db/connection.ts";
import { customers } from "./server/db/schema.ts";
import { eq, and } from "drizzle-orm";

// Load .env from the root directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: resolve(__dirname, ".env") });

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
  try {
    console.log('✅ Connected to database');

    // Get all customers with default coordinates
    const customersWithDefaultCoords = await db
      .select({
        id: customers.id,
        name: customers.name,
        address: customers.address,
        latitude: customers.latitude,
        longitude: customers.longitude
      })
      .from(customers)
      .where(
        and(
          eq(customers.latitude, "-37.8136"),
          eq(customers.longitude, "144.9631")
        )
      );

    console.log(`📊 Found ${customersWithDefaultCoords.length} customers with default coordinates`);

    if (customersWithDefaultCoords.length === 0) {
      console.log('✅ All customers already have real coordinates!');
      return;
    }

    let updatedCount = 0;
    let failedCount = 0;

    for (const customer of customersWithDefaultCoords) {
      console.log(`\n🔄 Processing: ${customer.name} - ${customer.address}`);
      
      const coordinates = await geocodeAddress(customer.address);
      
      if (coordinates) {
        await db
          .update(customers)
          .set({
            latitude: coordinates.latitude,
            longitude: coordinates.longitude
          })
          .where(eq(customers.id, customer.id));
        
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
  }
}

// Run the script
updateCustomerCoordinates().catch(console.error); 