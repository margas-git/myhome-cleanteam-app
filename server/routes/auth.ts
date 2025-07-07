import { Router, Request, Response } from "express";
import { z } from "zod";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { db } from "../db/connection.js";
import { users } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { authMiddleware } from "../middleware/auth.js";

const router = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6)
});

router.post("/login", async (req: Request, res: Response) => {
  const parse = loginSchema.safeParse(req.body);
  if (!parse.success) {
    return res.status(400).json({ success: false, error: "Invalid payload" });
  }

  const { email, password } = parse.data;
  
  const user = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!user.length) {
    return res.status(401).json({ success: false, error: "Invalid credentials" });
  }

  const valid = await bcrypt.compare(password, user[0].passwordHash);
  if (!valid) {
    return res.status(401).json({ success: false, error: "Invalid credentials" });
  }

  const token = jwt.sign(
    { sub: user[0].id, role: user[0].role }, 
    process.env.SESSION_SECRET ?? "secret", 
    { expiresIn: "1h" }
  );
  
  // Cookie settings that work with Safari
  const isProduction = process.env.NODE_ENV === 'production';
  const isLocalhost = req.get('host')?.includes('localhost') || req.get('host')?.includes('127.0.0.1');
  

  
  const cookieOptions = {
    httpOnly: true, 
    secure: isProduction, // Only use secure in production
    sameSite: isProduction ? "none" as "none" : "lax" as "lax", // Use none for cross-origin in production
    maxAge: 60 * 60 * 1000
  };
  
  res.cookie("token", token, cookieOptions);

  return res.json({ 
    success: true, 
    data: { 
      user: { 
        id: user[0].id, 
        email: user[0].email, 
        firstName: user[0].firstName,
        lastName: user[0].lastName,
        role: user[0].role 
      } 
    } 
  });
});

router.get("/me", authMiddleware, (req: Request, res: Response) => {
  return res.json({ success: true, data: { user: req.user } });
});

router.post("/logout", (req: Request, res: Response) => {
  // Use same cookie settings as login
  const isProduction = process.env.NODE_ENV === 'production';
  const isLocalhost = req.get('host')?.includes('localhost') || req.get('host')?.includes('127.0.0.1');
  

  
  res.clearCookie("token", {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" as "none" : "lax" as "lax"
  });
  return res.json({ success: true });
});

// Test endpoint to check environment variables
router.get("/debug-env", (req: Request, res: Response) => {
  return res.json({ 
    NODE_ENV: process.env.NODE_ENV,
    SESSION_SECRET: process.env.SESSION_SECRET ? 'SET' : 'NOT SET',
    CORS_ORIGIN: process.env.CORS_ORIGIN,
    message: "API is working"
  });
});

// Simple test endpoint
router.post("/test-login", (req: Request, res: Response) => {
  return res.json({ 
    success: true, 
    message: "Login endpoint is reachable",
    body: req.body
  });
});

// Test cookie setting endpoint
router.post("/test-cookie", (req: Request, res: Response) => {
  const testToken = "test-token-123";
  const isProduction = process.env.NODE_ENV === 'production';
  
  res.cookie("test-cookie", testToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" as "none" : "lax" as "lax",
    maxAge: 60 * 60 * 1000
  });
  
  return res.json({ 
    success: true, 
    message: "Test cookie set",
    cookieOptions: {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "none" : "lax"
    }
  });
});

// Test cookie reading endpoint
router.get("/test-cookie", (req: Request, res: Response) => {
  const testCookie = req.cookies?.["test-cookie"];
  return res.json({ 
    success: true, 
    testCookie: testCookie || "not found",
    allCookies: req.cookies
  });
});

export { router as authRouter }; 