import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: resolve(__dirname, "../.env") });

console.log("DATABASE_URL:", process.env.DATABASE_URL);
console.log("NODE_ENV:", process.env.NODE_ENV);
console.log("All env keys:", Object.keys(process.env)); 