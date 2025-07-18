import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
// Load .env from the root directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: resolve(__dirname, "../../.env") });
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
    console.error("DATABASE_URL environment variable is required");
    console.error("Current NODE_ENV:", process.env.NODE_ENV);
    console.error("Available env vars:", Object.keys(process.env).filter(k => k.includes('DATABASE')));
    throw new Error("DATABASE_URL environment variable is required");
}
const client = postgres(connectionString);
import * as schema from "./schema";
export const db = drizzle(client, { schema });
export { client };
