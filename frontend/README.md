# Datalyst frontend

This is the Next.js frontend for the existing Datalyst API and analytics services.

## Deploy

In Vercel, import the same repository and set Root Directory to frontend.
Vercel will run npm run build and serve this application. Keep the existing API and analytics services unchanged.

The public runtime-config.js contains only the API URL and Auth0 public client settings. Do not put database, Redis, or LLM secrets in it.
