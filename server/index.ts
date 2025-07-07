import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import express from "express";
import { createServer } from "./server.js";

// Load .env from the root directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: resolve(__dirname, "../.env") });

const port = process.env.PORT ? Number(process.env.PORT) : 4000;

const app = createServer();

// Serve static files from the built client
app.use(express.static(resolve(__dirname, "../client/dist")));

// Serve the React app for all non-API routes
app.get("*", (req, res) => {
  if (!req.path.startsWith("/api")) {
    res.sendFile(resolve(__dirname, "../client/dist/index.html"));
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
