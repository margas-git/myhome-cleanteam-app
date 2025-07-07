import express, { Request, Response } from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
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

  // 404 handler
  app.use((req: Request, res: Response) => {
    res.status(404).json({ success: false, error: "Not Found" });
  });

  // Error handler
  app.use((err: any, _req: Request, res: Response) => {
    console.error(err);
    res.status(500).json({ success: false, error: "Internal Server Error" });
  });

  return app;
} 