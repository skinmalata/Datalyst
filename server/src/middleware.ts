import { z } from "zod";
import type { Request, Response, NextFunction } from "express";

const requestCounts = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(maxRequests = 100, windowMs = 60_000) {
  return (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || req.socket.remoteAddress || "unknown";
    const now = Date.now();
    const entry = requestCounts.get(ip);
    if (!entry || now > entry.resetAt) {
      requestCounts.set(ip, { count: 1, resetAt: now + windowMs });
      return next();
    }
    entry.count++;
    if (entry.count > maxRequests) {
      res.status(429).json({ error: "Too many requests. Please try again later." });
      return;
    }
    next();
  };
}

export function validateBody<T extends z.ZodTypeAny>(schema: T) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const message = result.error.issues.map(i => `${i.path.join(".")}: ${i.message}`).join("; ");
      res.status(400).json({ error: `Invalid request: ${message}` });
      return;
    }
    req.body = result.data;
    next();
  };
}

export function validateQuery<T extends z.ZodTypeAny>(schema: T) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      const message = result.error.issues.map(i => `${i.path.join(".")}: ${i.message}`).join("; ");
      res.status(400).json({ error: `Invalid query: ${message}` });
      return;
    }
    req.query = result.data;
    next();
  };
}

export function requireJsonBody(req: Request, res: Response, next: NextFunction) {
  const contentType = req.headers["content-type"] || "";
  if (req.method !== "GET" && req.method !== "HEAD" && !contentType.includes("application/json")) {
    res.status(415).json({ error: "Content-Type must be application/json." });
    return;
  }
  next();
}

export function sanitizeString(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.replace(/[<>]/g, "").trim().slice(0, 1000);
}

const cleanupInterval = setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of requestCounts) {
    if (now > entry.resetAt) requestCounts.delete(key);
  }
}, 60_000);

if (cleanupInterval.unref) cleanupInterval.unref();
