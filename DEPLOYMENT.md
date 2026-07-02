# Deploying to Render or Railway

This project builds a Node.js server bundle via Nitro (`node-server` preset) at
`.output/server/index.mjs`. Any Node 20+ host works.

## Required environment variables

Set these on your host (Render dashboard / Railway variables):

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `VITE_SUPABASE_URL` (same value as `SUPABASE_URL`)
- `VITE_SUPABASE_PUBLISHABLE_KEY` (same as `SUPABASE_PUBLISHABLE_KEY`)
- `VITE_SUPABASE_PROJECT_ID`
- `TELEGRAM_BOT_TOKEN` (optional — can also be set in Settings UI)
- `TELEGRAM_WEBHOOK_SECRET` (optional)
- `LOVABLE_API_KEY` (only if you use Lovable AI features)

`PORT` is provided automatically by both platforms; the Node server reads it.

## Render

1. Push repo to GitHub.
2. New → Blueprint → point at repo (uses `render.yaml`), OR
   New → Web Service:
   - Runtime: **Node**
   - Build: `bun install && bun run build` (or `npm install && npm run build`)
   - Start: `node .output/server/index.mjs`
   - Node version: `20`
3. Add the env vars above.

## Railway

1. New Project → Deploy from GitHub.
2. Railway auto-detects via `railway.toml`:
   - Build: `bun install && bun run build`
   - Start: `node .output/server/index.mjs`
3. Add env vars in the Variables tab.

## Docker (Fly.io, self-host, etc.)

```
docker build -t pulse .
docker run -p 3000:3000 --env-file .env pulse
```

## Telegram webhook

After deploy, set the webhook to:

```
https://<your-domain>/api/public/telegram/webhook
```

You can register it from the Settings page in the dashboard.
