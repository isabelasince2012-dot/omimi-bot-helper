# tele-bot — Telegram Broadcast & Notification Dashboard

An open-source admin dashboard for running a Telegram bot: manage subscribers, send rich broadcasts, schedule announcements and reminders, reply to incoming support messages, and track delivery analytics.

![License](https://img.shields.io/badge/license-MIT-blue)

## Features

- **Auth** — email/password admin sign-in, password reset, role-based access (`admin` role stored in a dedicated `user_roles` table).
- **Dashboard** — total users, active today, messages sent, scheduled jobs, failed deliveries, growth charts.
- **Users** — searchable directory, status filters, CSV export, delete.
- **Broadcasts** — text/image/video/document + inline URL buttons, live preview, audiences (all / active / new users / hand-picked), send-now and resend, delivery counters and history.
- **Announcements** — title, body, priority, optional image, publish now or schedule.
- **Reminders** — one-off, daily, weekly or monthly schedules with timezone support.
- **Calendar** — unified view of upcoming broadcasts, announcements and reminders.
- **Inbox** — incoming user messages with reply templates and variable substitution (`{name}`, `{username}`).
- **Analytics** — joins over time, delivery success rate, failures, engagement.
- **Settings** — bot token, bot username, webhook URL, test bot, register webhook, verify connection.
- **Bot** — auto-registers users on `/start`, replies to `/help`, `/status` and greetings, inline keyboard menu.
- **Extras** — ⌘K command palette, light/dark theme toggle, PWA install support, toast notifications, empty states.

## Tech stack

React 19 · TypeScript · TanStack Start (Router + server functions) · Tailwind CSS v4 · shadcn/ui · Supabase (Postgres, Auth, RLS) · Telegram Bot API · Vite 7.

## Quick start

```bash
bun install
cp .env.example .env   # fill in your Supabase values
bun run dev            # http://localhost:8080
```

Create your first account at `/auth`, then grant it the `admin` role in the `user_roles` table.

## Environment variables

| Variable | Scope | Purpose |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | client | Supabase project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | client | Supabase publishable/anon key |
| `SUPABASE_URL` | server | Same URL, for server functions |
| `SUPABASE_PUBLISHABLE_KEY` | server | Same publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | server | Privileged operations only |
| `TELEGRAM_BOT_TOKEN` | server | Fallback bot token (can also be set in Settings) |
| `TELEGRAM_WEBHOOK_SECRET` | server | Optional; rejects unsigned webhook posts |

## Telegram setup

1. Create a bot with [@BotFather](https://t.me/BotFather) and copy the token.
2. Paste the token in **Settings → Bot token** and save.
3. Set the webhook URL to `https://<your-domain>/api/public/telegram/webhook` and hit **Register**.
4. Use **Verify connection** to confirm Telegram can reach the endpoint.

Diagnostic endpoints: `GET /api/public/telegram/verify` and `GET /api/public/telegram/webhook`.

## Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for step-by-step Render, Railway and Docker instructions plus the post-deploy checklist.

## Contributing

Issues and pull requests are welcome — see [CONTRIBUTING.md](./CONTRIBUTING.md).

## License

MIT — see [LICENSE](./LICENSE).
