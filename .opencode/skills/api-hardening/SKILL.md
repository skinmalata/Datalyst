---
name: api-hardening
description: Use when adding security middleware to a Node.js/Express API. Adds rate limiting, input validation with Zod, content-type checking, request size limits, and input sanitization. Trigger on keywords like "validation middleware", "rate limit", "input sanitization", "API security", "hardening".
---

# API Hardening

Adds security and validation middleware to Express.js APIs.

## Steps

1. **Create middleware module** (`server/src/middleware.ts`)
   - `rateLimit(maxRequests, windowMs)` — IP-based sliding window rate limiter with automatic cleanup
   - `validateBody(schema)` — Zod schema validation middleware that returns 400 with field-level error messages
   - `validateQuery(schema)` — Same for query parameters
   - `requireJsonBody` — Content-Type enforcement (returns 415 if not application/json)
   - `sanitizeString(value)` — Strips HTML tags and limits length

2. **Integrate into Express app** (`server/src/index.ts`)
   - Import middleware: `import { rateLimit, validateBody, requireJsonBody } from "./middleware.js";`
   - Add after cors/json setup:
     ```ts
     app.use(rateLimit(120, 60_000)); // 120 requests per minute
     app.use(requireJsonBody);
     ```
   - Reduce body size limit from 20mb to 10mb: `express.json({ limit: "10mb" })`

3. **Add dataset size validation**
   - Cap dataset rows: `z.array(z.record(z.unknown())).min(1).max(100000)`
   - Cap name length: `z.string().min(1).max(200)`

4. **Verify**
   - Check TypeScript compiles: `cd server && npx tsc --noEmit`
   - Confirm rate limiter cleans up intervals with `.unref()`

## Notes
- The rate limiter uses an in-memory Map with automatic cleanup every 60s
- Zod validation provides field-level error messages for debugging
- Body size limit of 10mb is sufficient for most datasets while preventing abuse
- The `sanitizeString` function is available for any user-generated content fields
