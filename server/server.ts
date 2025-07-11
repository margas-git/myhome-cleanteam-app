import express, { Request, Response } from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { existsSync } from "fs";
import { authRouter } from "./routes/auth.js";
import staffRouter from "./routes/staff.js";
import adminRouter from "./routes/admin.js";
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
  const corsOrigin = process.env.CORS_ORIGIN || "https://myhome-cleanteam.up.railway.app";
  
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

  // Health check
  app.get("/api/health", (_req: Request, res: Response) => res.json({ success: true, data: "ok" }));

  // Public routes
  app.get("/api/google-maps-api-key", (req: Request, res: Response) => {
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
  app.get("/api/google-maps-init", (req: Request, res: Response) => {
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

  // Serve static files from the built client (always, for debugging)
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  
  // Try multiple possible paths for static files
  const possibleStaticPaths = [
    resolve(__dirname, "../client/dist"),           // Local Docker
    resolve(__dirname, "../../client/dist"),        // Railway build
    resolve(process.cwd(), "client/dist"),          // Absolute from project root
    resolve(process.cwd(), "dist/client/dist")      // Alternative Railway structure
  ];
  
  const possibleIndexPaths = [
    resolve(__dirname, "../client/dist/index.html"),
    resolve(__dirname, "../../client/dist/index.html"),
    resolve(process.cwd(), "client/dist/index.html"),
    resolve(process.cwd(), "dist/client/dist/index.html")
  ];
  
  // Find the first path that exists
  let staticPath = possibleStaticPaths[0];
  let indexPath = possibleIndexPaths[0];
  
  for (let i = 0; i < possibleStaticPaths.length; i++) {
    if (existsSync(possibleStaticPaths[i])) {
      staticPath = possibleStaticPaths[i];
      indexPath = possibleIndexPaths[i];
      console.log(`Found static files at: ${staticPath}`);
      break;
    } else {
      console.log(`Path not found: ${possibleStaticPaths[i]}`);
    }
  }
  
  console.log("Static files path:", staticPath);
  console.log("Index file path:", indexPath);
  
  app.use(express.static(staticPath));

  // Serve the React app for all non-API routes
  app.get("*", (req: Request, res: Response) => {
    if (!req.path.startsWith("/api")) {
      console.log("Serving React app for path:", req.path);
      res.sendFile(indexPath);
    }
  });

  // Error handler
  app.use((err: any, _req: Request, res: Response) => {
    console.error(err);
    res.status(500).json({ success: false, error: "Internal Server Error" });
  });

  return app;
} 