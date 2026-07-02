# Deploying Pulse (Telegram Broadcast Dashboard)

This project builds a Node.js server bundle via Nitro (`node-server` preset) at
`.output/server/index.mjs`. Any Node 20+ host works — Render, Railway, Fly.io,
a plain VPS, or Docker.

The two supported hosts below (Render and Railway) have first-class config
files in the repo (`render.yaml`, `railway.toml`, `Dockerfile`).

---

## 0. Prerequisites (do this once)

Before touching Render/Railway, collect these values. You'll paste them into
the host's Environment / Variables tab.

### 0.1 Supabase (backend) credentials

From your Supabase project → **Project Settings → API**:

| Variable | Where to find it | Notes |
| --- | --- | --- |
| `SUPABASE_URL` | Project Settings → API → Project URL | e.g. `https://abcd1234.supabase.co` |
| `SUPABASE_PUBLISHABLE_KEY` | Project Settings → API → `anon` / `publishable` key | Safe for client |
| `SUPABASE_SERVICE_ROLE_KEY` | Project Settings → API → `service_role` key | **Secret** — server only, never commit |
| `VITE_SUPABASE_URL` | Same as `SUPABASE_URL` | Duplicated for the client bundle |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Same as `SUPABASE_PUBLISHABLE_KEY` | Duplicated for the client bundle |
| `VITE_SUPABASE_PROJECT_ID` | The subdomain before `.supabase.co` | e.g. `abcd1234` |

All six are **required** — the app will fail to boot without them.

### 0.2 Telegram bot

1. Open Telegram, message **@BotFather**, send `/newbot` (or `/mybots` for an
   existing one).
2. Copy the token — looks like `123456789:AAE9KUbb...`.
3. You can either:
   - Paste it in the dashboard's **Settings → Bot token** field after first
     login (stored in the DB), **or**
   - Set it as `TELEGRAM_BOT_TOKEN` env var on the host (fallback).
4. Generate a webhook secret (any random string, e.g. `openssl rand -hex 32`)
   and save it as `TELEGRAM_WEBHOOK_SECRET`. This prevents third parties from
   posting fake updates to your webhook.

### 0.3 Optional

- `LOVABLE_API_KEY` — only if you use Lovable AI Gateway features.

---

## 1. Deploy to Render

### 1.1 Push the repo to GitHub

Render deploys from a Git repo. Push this project to GitHub/GitLab first.

### 1.2 Create the service

**Option A — Blueprint (recommended):**

1. Render Dashboard → **New +** → **Blueprint**.
2. Connect the repo. Render reads `render.yaml` and pre-fills the service.
3. Confirm: Runtime **Node**, Plan **Starter** (or higher), Region of your
   choice.
4. Click **Apply**.

**Option B — Manual Web Service:**

1. Render Dashboard → **New +** → **Web Service** → connect the repo.
2. Fill in:
   - **Runtime**: Node
   - **Build Command**: `bun install && bun run build`
     (or `npm install && npm run build` if you prefer npm)
   - **Start Command**: `node .output/server/index.mjs`
   - **Node Version**: `20` (set in **Environment** tab, key `NODE_VERSION`)

### 1.3 Add environment variables

Service → **Environment** → **Add Environment Variable**, one per row:

```
SUPABASE_URL                    = https://<ref>.supabase.co
SUPABASE_PUBLISHABLE_KEY        = <anon key>
SUPABASE_SERVICE_ROLE_KEY       = <service role key>   ← mark as Secret
VITE_SUPABASE_URL               = https://<ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY   = <anon key>
VITE_SUPABASE_PROJECT_ID        = <ref>
TELEGRAM_BOT_TOKEN              = 123456:AAE...        (optional, DB overrides)
TELEGRAM_WEBHOOK_SECRET         = <random 32+ chars>
LOVABLE_API_KEY                 = <if used>
NODE_VERSION                    = 20
```

`PORT` is injected automatically — don't set it.

### 1.4 Deploy & verify

1. Click **Manual Deploy → Deploy latest commit** (or push to the connected
   branch).
2. Watch logs. Build should finish with `Nitro built .output/server/index.mjs`.
3. Once live, open `https://<your-service>.onrender.com` — you should see the
   landing page.
4. Sign up — the **first account** is auto-promoted to admin.

### 1.5 Register the Telegram webhook (Render)

After the site is live at `https://<your-service>.onrender.com`:

1. Log into the dashboard → **Settings**.
2. Paste the bot token (if not set as env var) → **Test bot** → confirm you
   see `Connected to @yourbot`.
3. Set **Webhook URL** to:
   ```
   https://<your-service>.onrender.com/api/public/telegram/webhook
   ```
4. Click **Register**. You should see a success toast.
5. Open your bot in Telegram, send `/start`. You should get the welcome menu,
   and the user should appear in the dashboard's **Users** page.

If webhook fails: check the service logs on Render for `401 Unauthorized`
(wrong `TELEGRAM_WEBHOOK_SECRET`) or `404` (wrong token).

---

## 2. Deploy to Railway

### 2.1 Create the project

1. Railway Dashboard → **New Project** → **Deploy from GitHub repo**.
2. Select the repo. Railway auto-detects `railway.toml`:
   - Builder: **Nixpacks**
   - Build: `bun install && bun run build`
   - Start: `node .output/server/index.mjs`
   - Restart policy: `ON_FAILURE`

### 2.2 Add environment variables

Project → **Variables** tab → **Raw Editor** and paste:

```
SUPABASE_URL=https://<ref>.supabase.co
SUPABASE_PUBLISHABLE_KEY=<anon key>
SUPABASE_SERVICE_ROLE_KEY=<service role key>
VITE_SUPABASE_URL=https://<ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<anon key>
VITE_SUPABASE_PROJECT_ID=<ref>
TELEGRAM_BOT_TOKEN=123456:AAE...
TELEGRAM_WEBHOOK_SECRET=<random 32+ chars>
LOVABLE_API_KEY=<if used>
NODE_VERSION=20
```

`PORT` is injected by Railway — leave it alone.

### 2.3 Expose a public URL

1. Service → **Settings** → **Networking** → **Generate Domain**.
2. Railway gives you `https://<name>.up.railway.app`.
3. (Optional) Add a custom domain in the same panel and point a CNAME to it.

### 2.4 Deploy & verify

1. Railway auto-deploys on push. First deploy runs automatically after you
   set variables.
2. Check **Deployments → View Logs** for `Nitro built .output/server/index.mjs`.
3. Open the generated URL, sign up (first user = admin).

### 2.5 Register the Telegram webhook (Railway)

Same as Render (§1.5), but the URL is:

```
https://<name>.up.railway.app/api/public/telegram/webhook
```

Settings → paste token → **Test bot** → paste webhook URL → **Register**.

---

## 3. Docker / self-host

```bash
docker build -t pulse .
docker run -p 3000:3000 --env-file .env pulse
```

`.env` must contain the same variables listed in §0.1–0.3. Point Telegram's
webhook to `https://<your-domain>/api/public/telegram/webhook`.

---

## 4. Post-deploy checklist

- [ ] Landing page loads at the deployed URL
- [ ] Sign up works; first user has **admin** role (verify in
      Supabase → `user_roles` table)
- [ ] Settings → **Test bot** returns `Connected to @yourbot`
- [ ] Settings → **Register** webhook succeeds
- [ ] `/start` in Telegram creates a row in the dashboard's Users page
- [ ] Sending a test broadcast to "All users" delivers to Telegram and
      updates `sent_count` on the broadcast row
- [ ] Free-form message in Telegram lands in the **Inbox** page
- [ ] Reply from the Inbox appears in the Telegram chat

---

## 5. Troubleshooting

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| Build fails at `bun install` | Node < 20 | Set `NODE_VERSION=20` env var |
| Site loads but sign-in shows "Invalid API key" | Missing/wrong `VITE_SUPABASE_*` | Re-check §0.1, redeploy |
| Every admin action returns "Forbidden" | Your account isn't `admin` in `user_roles` | Insert a row `(user_id, 'admin')` in Supabase SQL editor |
| Telegram webhook returns 401 | `TELEGRAM_WEBHOOK_SECRET` mismatch | Ensure the env var matches what Telegram sends (re-Register from Settings) |
| `/start` doesn't create a user | Webhook not registered, or wrong URL | Settings → Register; check host logs for POSTs to `/api/public/telegram/webhook` |
| Broadcasts save but don't send | Bot token invalid or missing | Settings → Test bot; fix token; Resend from history |
