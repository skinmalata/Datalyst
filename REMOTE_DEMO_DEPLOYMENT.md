# Put TrueAnalyzer on the internet — simple guide

This guide puts your demo on the internet so you can open it with a normal web link and show it to people.

## Important first note

There are two parts of TrueAnalyzer:

1. The **website** people can see and use.
2. The **behind-the-scenes services** that save data, run forecasts, and use AI.

You can put the website online now. It will let people upload a small file and see the demo analysis in their own browser.

The website is **not connected to the behind-the-scenes services yet**. Login, saved data, and shared workspaces need one more code update before they work together. This guide still sets up the services so they are ready for that next update.

Do not upload private customer data, passwords, bank details, or health information. Use sample data only.

## The websites you need

Make free accounts on these websites. You can use a parent, teacher, or trusted adult if a website asks for help with signup.

| What it does | Website | Simple meaning |
| --- | --- | --- |
| Stores the website | [Vercel](https://vercel.com) | Gives your website a public link |
| Runs the API and forecast service | [Render](https://render.com) | Runs the behind-the-scenes code |
| Stores the database | [Supabase](https://supabase.com) | Safely stores small demo data tables |
| Handles login later | [Auth0](https://auth0.com) | Makes sign-in safer |
| Helps turn questions into plans | [Groq](https://groq.com) | Gives the API an AI helper |
| Stores your code | [GitHub](https://github.com) | Keeps a copy of your project online |

Free plans are for learning and demos. They can be slow, pause after not being used, or change their limits.

## Step 1: Put your code on GitHub

GitHub needs your project before Vercel and Render can use it.

1. Install [Git](https://git-scm.com/) if it is not already on your computer.
2. Open PowerShell.
3. Copy and run this command:

```powershell
cd "C:\Users\Toks\Documents\Apps\hackaton devpost\data analyst"
```

4. Ask Git if this folder is already set up:

```powershell
git status
```

5. If it says it is **not** a Git repository, run:

```powershell
git init
```

6. Save your files in Git:

```powershell
git add .
git status
git commit -m "TrueAnalyzer demo"
```

Before pressing Enter on the commit command, look at `git status`. Stop if you see a file called `.env`, a password, a key, or private data. The included `.gitignore` is meant to keep those files out.

7. On GitHub, make a new empty repository called `trueanalyzer`.
8. GitHub will show commands like these. Replace `YOUR-NAME` with your GitHub name:

```powershell
git branch -M main
git remote add origin https://github.com/YOUR-NAME/trueanalyzer.git
git push -u origin main
```

## Step 2: Put the website online with Vercel

This is the easiest and most useful step. After it works, you will have a real website link to share.

1. Open [Vercel](https://vercel.com) and sign in with GitHub.
2. Click **Add New**, then **Project**.
3. Choose your `trueanalyzer` GitHub repository.
4. For **Framework Preset**, choose **Other**.
5. Leave **Build Command** empty.
6. Keep the **Root Directory** as the main folder.
7. Click **Deploy**.
8. Wait for Vercel to show a link such as `https://trueanalyzer.vercel.app`.
9. Open the link. Your demo website should appear.

Try uploading a small CSV or JSON file, then ask:

- `Show sales over time`
- `Which region is doing best?`
- `Find unusual sales values`
- `Forecast next year revenue`

## Step 3: Make the Supabase database

1. Open [Supabase](https://supabase.com) and make a free project.
2. Give it a simple name such as `trueanalyzer-demo`.
3. Wait for the project to finish starting.
4. Find **Project Settings**, then **Database**.
5. Copy the **connection string**. It starts with `postgresql://`.
6. Keep it private. It is like a password for the database.
7. Open **SQL Editor** in Supabase.
8. Open this file on your computer: `server/sql/001_init.sql`.
9. Copy everything in that file, paste it into Supabase SQL Editor, and click **Run**.

You only do this database-table step once.

## Step 4: Make the small queue in Render

1. Go back to [Render](https://render.com).
2. Click **New**, then **Key Value**.
3. Give it a name such as `trueanalyzer-queue`.
4. Choose the **same region** you will choose for the API service.
5. Choose the free option and click **Create Key Value**.
6. Wait until it says it is ready.
7. Click **Connect** and copy the **Internal URL**. It starts with `redis://`.

Only copy the Internal URL into the API settings in Step 8. Do not share it publicly.

## Step 5: Make the Auth0 login setup

You need this later when the website and API are connected.

1. Open [Auth0](https://auth0.com).
2. Make an **API** named `TrueAnalyzer API`.
3. Give it this identifier exactly:

```text
trueanalyzer-api
```

4. Make a **Single Page Application** named `TrueAnalyzer Website`.
5. Save the Auth0 domain somewhere safe. It looks like `something.us.auth0.com`.

Do not worry about callback URLs yet. Add the Vercel link from Step 2 when the login code is ready.

## Step 6: Get the AI key

1. Open [Groq](https://groq.com).
2. Create an API key.
3. Copy it into a safe private note or password manager.
4. Never put it in GitHub, a JavaScript file, or a screenshot.

## Step 7: Put the forecast service online with Render

1. Open [Render](https://render.com) and sign in with GitHub.
2. Click **New**, then **Web Service**.
3. Pick your `trueanalyzer` repository.
4. Set **Root Directory** to:

```text
analytics-service
```

5. Choose **Docker**.
6. Click **Deploy Web Service**.
7. When it finishes, open this link, using your own Render address:

```text
https://YOUR-ANALYTICS-SERVICE.onrender.com/health
```

You should see:

```json
{"ok": true}
```

## Step 8: Put the API online with Render

1. In Render, click **New**, then **Web Service** again.
2. Pick the same GitHub repository.
3. Set **Root Directory** to:

```text
server
```

4. Choose **Docker**.
5. Add these secret settings in Render's **Environment** page:

```text
POSTGRES_URL=the Supabase connection string from Step 3
REDIS_URL=the Render Key Value Internal URL from Step 4
ANALYTICS_URL=https://YOUR-ANALYTICS-SERVICE.onrender.com
WEB_ORIGIN=https://YOUR-WEBSITE.vercel.app
OIDC_ISSUER=https://YOUR-AUTH0-DOMAIN/
OIDC_AUDIENCE=trueanalyzer-api
LLM_API_URL=https://api.groq.com/openai/v1/chat/completions
LLM_API_KEY=the Groq key from Step 6
LLM_MODEL=llama-3.3-70b-versatile
```

6. Click **Deploy Web Service**.
7. Check this link:

```text
https://YOUR-API-SERVICE.onrender.com/api/health
```

You should see `{"ok": true, "service": "trueanalyzer-api"}`.

## What works after these steps

- A public Vercel website link
- A public API health-check link
- A public forecast-service health-check link
- A Supabase database ready for the API
- Auth0 and Groq accounts ready for the next code update

## What does **not** work together yet

These parts need the next code update:

- Signing in on the website
- Sending uploaded files from the website to Supabase through the API
- Asking the API to run and save an analysis
- Seeing shared workspaces and audit history in the website

Until then, the Vercel website is a browser-only demo. That is okay for showing the design and the data-analysis features with sample files.

## If something goes wrong

- Website does not open: check the Vercel **Deployments** page.
- API health link does not work: check the Render API service **Logs** page.
- Forecast health link does not work: check the Render analytics service **Logs** page.
- Database table error: go back to Supabase **SQL Editor** and run `server/sql/001_init.sql` again.
- Never post secret keys or connection strings in chat, GitHub issues, screenshots, or public messages.
