import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { db } from "../db/connection.js";
import { users } from "../db/schema.js";
import { eq } from "drizzle-orm";

interface JwtPayload {
  sub: number;
  role: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number;
        email: string;
        firstName: string;
        lastName: string;
        role: string;
      };
    }
  }
}

export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  try {
    const token = req.cookies?.token;
    if (!token) {
      return res.status(401).json({ success: false, error: "Authentication required" });
    }

    const payload = jwt.verify(token, process.env.SESSION_SECRET ?? "secret") as unknown as JwtPayload;
    const user = await db.select().from(users).where(eq(users.id, payload.sub)).limit(1);
    
    if (!user.length) {
      return res.status(401).json({ success: false, error: "User not found" });
    }

    req.user = {
      id: user[0].id,
      email: user[0].email,
      firstName: user[0].firstName,
      lastName: user[0].lastName,
      role: user[0].role
    };

    next();
  } catch (error) {
    return res.status(401).json({ success: false, error: "Invalid token" });
  }
} 