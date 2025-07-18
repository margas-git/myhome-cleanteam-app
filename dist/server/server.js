import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { existsSync } from "fs";
import { authRouter } from "./routes/auth.js";
import staffRouter from "./routes/staff.js";
import adminRouter from "./routes/admin.js";
import invoiceRouter from "./routes/invoices.js";
import { authMiddleware } from "./middleware/auth.js";
// import other route modules as they are implemented
export function createServer() {
    const app = express();
    // Configure helmet with CSP that allows Google Maps
    // Temporarily disable helmet for local development to fix Safari issues
    if (process.env.NODE_ENV === 'production') {
        app.use(helmet({
            contentSecurityPolicy: {
                directives: {
                    defaultSrc: ["'self'"],
                    scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://maps.googleapis.com", "https://maps.gstatic.com"],
                    styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://maps.googleapis.com"],
                    fontSrc: ["'self'", "https://fonts.gstatic.com"],
                    imgSrc: ["'self'", "data:", "https://maps.googleapis.com", "https://maps.gstatic.com", "https://streetviewpixels-pa.googleapis.com", "https://*.googleapis.com"],
                    connectSrc: ["'self'", "https://maps.googleapis.com", "https://*.googleapis.com"],
                    frameSrc: ["'self'", "https://maps.googleapis.com"],
                    objectSrc: ["'none'"],
                    mediaSrc: ["'self'"],
                    manifestSrc: ["'self'"],
                },
            },
        }));
    }
    // CORS configuration
    const corsOrigin = process.env.CORS_ORIGIN || "https://myhome-cleanteam-wip.up.railway.app";
    // Allow localhost for development
    const allowedOrigins = [
        corsOrigin,
        "http://localhost:5173",
        "http://localhost:4000",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:4000",
        "http://127.0.0.1:3000"
    ];
    app.use(cors({
        origin: true, // Allow all origins in development
        credentials: true
    }));
    app.use(express.json());
    app.use(cookieParser());
    // Log all requests for debugging
    app.use((req, res, next) => {
        console.log(`${req.method} ${req.path}`);
        next();
    });
    // Health check
    app.get("/api/health", (_req, res) => res.json({ success: true, data: "ok" }));
    // Public routes
    app.get("/api/google-maps-api-key", (req, res) => {
        const apiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.VITE_GOOGLE_MAPS_API_KEY;
        console.log('🔑 Server API Key Debug:', {
            hasGoogleMapsKey: !!process.env.GOOGLE_MAPS_API_KEY,
            hasViteKey: !!process.env.VITE_GOOGLE_MAPS_API_KEY,
            keyLength: apiKey?.length || 0,
            keyPreview: apiKey ? `${apiKey.substring(0, 10)}...` : 'undefined'
        });
        res.json({ apiKey });
    });
    // New endpoint for Google Maps initialization
    app.get("/api/google-maps-init", (req, res) => {
        const apiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.VITE_GOOGLE_MAPS_API_KEY;
        console.log('🗺️ Google Maps Init Debug:', {
            hasApiKey: !!apiKey,
            keyLength: apiKey?.length || 0,
            keyPreview: apiKey ? `${apiKey.substring(0, 10)}...` : 'undefined'
        });
        if (!apiKey) {
            return res.status(500).json({
                success: false,
                error: "Google Maps API key not configured"
            });
        }
        res.json({
            success: true,
            apiKey,
            scriptUrl: `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places,geometry&loading=async`
        });
    });
    // Protected routes
    app.use("/api/auth", authRouter);
    app.use("/api/staff", authMiddleware, staffRouter);
    app.use("/api/admin", authMiddleware, adminRouter);
    app.use("/api/invoices", authMiddleware, invoiceRouter);
    // Only serve static files in production
    if (process.env.NODE_ENV === 'production') {
        // Serve static files from the built client
        const __filename = fileURLToPath(import.meta.url);
        const __dirname = dirname(__filename);
        const staticPath = resolve(__dirname, "../../client/dist");
        const indexPath = resolve(__dirname, "../../client/dist/index.html");
        console.log("Static files path:", staticPath);
        console.log("Index file path:", indexPath);
        console.log("NODE_ENV:", process.env.NODE_ENV);
        console.log("__dirname:", __dirname);
        // Debug: Check if files exist
        console.log("Static path exists:", existsSync(staticPath));
        console.log("Index file exists:", existsSync(indexPath));
        app.use(express.static(staticPath));
        // Serve the React app for all non-API routes
        app.get("*", (req, res) => {
            if (!req.path.startsWith("/api")) {
                console.log("Serving React app for path:", req.path);
                res.sendFile(indexPath);
            }
        });
    }
    else {
        // In development, only serve API routes
        app.get("*", (req, res) => {
            if (!req.path.startsWith("/api")) {
                res.status(404).json({
                    success: false,
                    error: "Not found. In development, the frontend runs on port 5173"
                });
            }
        });
    }
    // Error handler
    app.use((err, _req, res) => {
        console.error(err);
        res.status(500).json({ success: false, error: "Internal Server Error" });
    });
    return app;
}
