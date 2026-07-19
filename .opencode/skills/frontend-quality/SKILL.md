---
name: frontend-quality
description: Use when improving a vanilla JavaScript frontend. Adds global error handling (window.onerror, unhandledrejection, script load errors), onboarding flow UI, and API consolidation. Trigger on keywords like "error handling", "global errors", "onboarding", "frontend quality", "wire to API".
---

# Frontend Quality

Adds error handling, onboarding flows, and API integration to static JavaScript frontends.

## Steps

1. **Add global error handler** (`error-handler.js`)
   - `window.error` — catches runtime errors, shows toast with file/line info
   - `window.unhandledrejection` — catches promise rejections
   - `DOMContentLoaded` — monitors script load failures
   - All handlers show user-friendly toast messages (5s duration)
   - Must be loaded FIRST in index.html (before all other scripts)

2. **Add onboarding flow** (`onboarding.js` + HTML modal)
   - Create modal HTML in index.html with workspace name input
   - Create JS that:
     - Shows modal via `window.showOnboarding()`
     - Calls `POST /api/onboarding` with auth token
     - Stores `organizationId` in localStorage
     - Dispatches `datalyst:onboarded` custom event
   - Wire into auth flow: when user authenticates but has no org, show onboarding

3. **Wire static demo to API** (update `remote-demo.js`)
   - When authenticated, wrap `enterpriseAnalyze` to call API first
   - Fall back to browser-local analysis on API error
   - Store token in `window._datalystToken` for onboarding requests

4. **Script loading order in index.html**
   ```html
   <script src="error-handler.js"></script>  <!-- MUST be first -->
   <script src="data-import.js"></script>
   <script src="app.js"></script>
   <!-- ... other scripts ... -->
   <script src="runtime-config.js"></script>
   <script src="onboarding.js"></script>     <!-- before remote-demo -->
   <script src="remote-demo.js"></script>
   <script src="landing.js"></script>
   ```

## Notes
- Error handler must load before all other scripts to catch their failures
- Onboarding modal reuses the `.upload-modal` CSS class for consistent styling
- The `datalyst:onboarded` event allows other components to react to workspace creation
- API consolidation is graceful: if API fails, browser-local analysis still works
