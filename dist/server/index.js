import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { createServer } from "./server.js";
// Load .env from the root directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: resolve(__dirname, "../.env") });
const port = process.env.PORT ? Number(process.env.PORT) : 4000;
const app = createServer();
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
