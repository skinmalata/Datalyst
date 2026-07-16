import { createRemoteJWKSet, jwtVerify } from "jose";
import type { Request, Response, NextFunction } from "express";
import { pool, type Tenant } from "./db.js";

declare global { namespace Express { interface Request { tenant?: Tenant; } } }
const roleSet = new Set(["viewer","analyst","steward","admin","auditor"]);
export async function authenticate(req: Request, res: Response, next: NextFunction) {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) return res.status(401).json({ error: "Sign in is required." });
    const issuer = process.env.OIDC_ISSUER, audience = process.env.OIDC_AUDIENCE;
    if (!issuer || !audience) return res.status(503).json({ error: "SSO is not configured. Set OIDC_ISSUER and OIDC_AUDIENCE." });
    const jwks = createRemoteJWKSet(new URL(`${issuer.replace(/\/$/, "")}/.well-known/jwks.json`));
    const { payload } = await jwtVerify(token, jwks, { issuer, audience });
    const organizationId = String(req.headers["x-organization-id"] || "");
    const membership = await pool.query("SELECT u.id AS user_id, m.role FROM users u JOIN memberships m ON m.user_id=u.id WHERE u.oidc_subject=$1 AND m.organization_id=$2", [payload.sub, organizationId]);
    if (!membership.rowCount || !roleSet.has(membership.rows[0].role)) return res.status(403).json({ error: "You do not have access to this workspace." });
    req.tenant = { organizationId, userId: membership.rows[0].user_id, role: membership.rows[0].role }; next();
  } catch { return res.status(401).json({ error: "Your sign-in session is invalid or expired." }); }
}
export function allow(...roles: Tenant["role"][]) { return (req: Request, res: Response, next: NextFunction) => roles.includes(req.tenant!.role) ? next() : res.status(403).json({ error: "Your role cannot perform this action." }); }
