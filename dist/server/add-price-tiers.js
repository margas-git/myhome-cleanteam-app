import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { db } from "./db/connection";
import { timeAllocationTiers } from "./db/schema";
// Load .env from the root directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: resolve(__dirname, "../../.env") });
async function addPriceTiers() {
    console.log("💰 Adding default price tiers...");
    try {
        // Check if price tiers already exist
        const existingTiers = await db.select().from(timeAllocationTiers);
        if (existingTiers.length > 0) {
            console.log("✅ Price tiers already exist:", existingTiers.length, "tiers found");
            return;
        }
        // Create default price tiers
        await db.insert(timeAllocationTiers).values([
            {
                priceMin: "100.00",
                priceMax: "150.00",
                allottedMinutes: 90
            },
            {
                priceMin: "151.00",
                priceMax: "200.00",
                allottedMinutes: 120
            },
            {
                priceMin: "201.00",
                priceMax: "250.00",
                allottedMinutes: 150
            },
            {
                priceMin: "251.00",
                priceMax: "300.00",
                allottedMinutes: 180
            },
            {
                priceMin: "301.00",
                priceMax: "400.00",
                allottedMinutes: 240
            }
        ]);
        console.log("✅ Default price tiers added successfully!");
    }
    catch (error) {
        console.error("❌ Error adding price tiers:", error);
    }
    process.exit(0);
}
addPriceTiers().catch(console.error);
