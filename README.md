# TrueAnalyzer demo guide

For the corrected, step-by-step remote deployment guide, read [REMOTE_DEMO_DEPLOYMENT.md](REMOTE_DEMO_DEPLOYMENT.md).

TrueAnalyzer is a data-analysis demo with a browser experience in the project root, a Node API in `server/`, and a Python forecasting service in `analytics-service/`.

The browser demo now produces data-derived trends, group comparisons, IQR outlier screening, data-quality evidence, and charts from an uploaded dataset. The API adds governed analysis plans, auditable dataset records, role checks, and validated forecasting.

> This is a demonstration environment, not a production deployment. Do not upload customer, financial, health, or other sensitive data.

## What the demo can show

- Dataset profiling: record count, field count, completeness, and exact duplicates
- Descriptive totals and averages from numeric data
- Group comparisons (for example region, category, or product)
- Time-series trends from a date field
- IQR-based potential-outlier screening
- Forecasts with a 1–3 period holdout, MAE/MAPE, and seasonal modeling when at least two complete cycles are available
- Backend analysis plans with approved fields, filters, comparisons, audit events, and tenant access checks

## Recommended demo dataset

Use non-sensitive CSV or JSON data with these fields where possible:

- a date field, such as `Date` or `Order Date`
- a numeric measure, such as `Sales`, `Revenue`, `Amount`, or `Profit`
- one or more dimensions, such as `Region`, `Category`, `Product`, or `Segment`

For a meaningful seasonal forecast, use at least 24 regular monthly periods. Shorter data can still produce a trend forecast, but it will not claim seasonality.

## Free remote-demo stack

Create free accounts for the following services. Keep all keys in their provider dashboards; never commit them to this repository.

| Purpose | Suggested service | What to create |
| --- | --- | --- |
| Static frontend | Render Static Site | One site for this repository root |
| API | Render Web Service | One Docker service rooted at `server/` |
| Forecasting | Render Web Service | One Docker service rooted at `analytics-service/` |
| PostgreSQL | Supabase Free | One database and its connection string |
| Authentication | Auth0 Free | One Single Page Application and one API |
| AI planner | Groq Free | One API key for the server only |
| Job queue | Render Key Value | One internal Redis-compatible connection URL |

Free plans can sleep, impose quotas, or change their terms. They are appropriate for demos and learning, not uptime-sensitive production use.

## 1. Create Auth0 applications

1. In Auth0, create an **API** with identifier `trueanalyzer-api`.
2. Create a **Single Page Application** for the frontend.
3. After the frontend has a Render URL, add that URL to Auth0's allowed callback URLs, logout URLs, and allowed web origins.
4. Copy the Auth0 domain and API identifier. The API uses the domain as `OIDC_ISSUER` and `trueanalyzer-api` as `OIDC_AUDIENCE`.

The server checks the JWT and then checks its own `users` and `memberships` tables. Before a user can call protected endpoints, create an organisation, a user whose `oidc_subject` matches the Auth0 user `sub`, and a membership. This onboarding flow is not yet exposed through the browser UI.

## 2. Create database, Redis, and AI credentials

1. Create a Neon PostgreSQL project and copy its pooled PostgreSQL connection string.
2. Create a Redis-compatible instance and copy its connection URL. Use `rediss://` when the provider requires TLS.
3. Create a Groq API key. Use it only as a server environment variable.

The database schema is in `server/sql/001_init.sql`. Apply it once to the new database using Neon’s SQL editor or a PostgreSQL client.

## 3. Deploy the forecasting service

Create a Render **Web Service** from this repository:

- Root directory: `analytics-service`
- Runtime: Docker
- Public health URL: `https://YOUR-ANALYTICS-SERVICE.onrender.com/health`

Confirm that the health URL responds with `{"ok": true}` before deploying the API.

## 4. Deploy the API

Create a second Render **Web Service**:

- Root directory: `server`
- Runtime: Docker
- Health URL: `https://YOUR-API-SERVICE.onrender.com/api/health`

Set these environment variables in Render:

```text
POSTGRES_URL=your Neon connection string
REDIS_URL=your Redis connection URL
PORT=3001
ANALYTICS_URL=https://YOUR-ANALYTICS-SERVICE.onrender.com
WEB_ORIGIN=https://YOUR-FRONTEND.onrender.com
OIDC_ISSUER=https://YOUR-AUTH0-DOMAIN/
OIDC_AUDIENCE=trueanalyzer-api
LLM_API_URL=https://api.groq.com/openai/v1/chat/completions
LLM_API_KEY=your Groq server key
LLM_MODEL=llama-3.3-70b-versatile
```

Do not set `LLM_API_KEY` or database credentials in frontend files.

## 5. Deploy the frontend

Create a Render **Static Site**:

- Publish directory: `.`
- Build command: leave blank

The root interface can be publicly hosted this way today, but it currently performs browser-local analysis after a user uploads a file. The next integration step is to add Auth0 login and point the upload, planning, analysis, audit, and chart actions at the deployed API. Do not present the static site as a connected multi-user workspace until that integration is complete.

## 6. Verify the demo

After deployment, check these URLs:

1. `https://YOUR-API-SERVICE.onrender.com/api/health`
2. `https://YOUR-ANALYTICS-SERVICE.onrender.com/health`
3. Your static frontend URL

For the browser demo, upload a small non-sensitive CSV/JSON file and try:

- `Show the sales trend over time`
- `Which region is performing best?`
- `Find unusual sales values`
- `Forecast next year revenue`

For the protected API, send a valid Auth0 bearer token and an `x-organization-id` header belonging to that user.

## Local development

1. Copy `.env.example` to `.env`.
2. Fill in the service configuration.
3. Run `docker compose up --build`.
4. Open `http://localhost:3001/api/health` and `http://localhost:8000/health`.

## Before calling anything production-ready

Implement and verify all of the following before handling real customer data:

- Browser/API authentication and onboarding
- Proper database roles that cannot bypass row-level security
- Persistent source-to-result lineage and metric approval workflows
- Object storage, malware scanning, upload limits, and retention/deletion rules
- Automated tests, monitoring, backups, rate limits, and incident handling
- Independent security review and privacy/compliance review
