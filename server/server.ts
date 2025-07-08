import express, { Request, Response } from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { authRouter } from "./routes/auth.js";
import staffRouter from "./routes/staff.js";
import adminRouter from "./routes/admin.js";
import { authMiddleware } from "./middleware/auth.js";
// import other route modules as they are implemented

export function createServer() {
  const app = express();

  app.use(helmet());
  // CORS configuration for production
  const corsOrigin = process.env.CORS_ORIGIN || "https://my-home-clean-team-web.vercel.app";
  
  app.use(cors({ 
    origin: corsOrigin, 
    credentials: true 
  }));
  app.use(express.json());
  app.use(cookieParser());

  // Health check
  app.get("/api/health", (_req: Request, res: Response) => res.json({ success: true, data: "ok" }));

  // Routes
  app.use("/api/auth", authRouter);
  app.use("/api/staff", authMiddleware, staffRouter);
  app.use("/api/admin", authMiddleware, adminRouter);

  // Serve static files from the built client
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const staticPath = resolve(__dirname, "../client/dist");
  const indexPath = resolve(__dirname, "../client/dist/index.html");
  
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