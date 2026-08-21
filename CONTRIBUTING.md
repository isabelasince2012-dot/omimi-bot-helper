# Contributing to tele-bot

Thanks for helping out! This project is MIT licensed and open to contributions of any size.

## Getting set up

```bash
bun install
cp .env.example .env
bun run dev
```

## Ground rules

- Keep TypeScript strict — no `any` escapes unless unavoidable.
- Pages live in `src/routes/`, reusable UI in `src/components/`, server logic in `*.functions.ts`.
- Never commit real tokens, keys or `.env` files.
- Database changes go in a migration, never applied by hand.
- Use design tokens (`bg-background`, `text-muted-foreground`, …) instead of hardcoded colors so both themes keep working.

## Pull requests

1. Fork and branch off `main` (`feat/…`, `fix/…`).
2. Make the change and run `bun run build` locally.
3. Describe what changed and how you tested it, screenshots for UI work.

## Reporting bugs

Open an issue with reproduction steps, expected vs actual behaviour, and any console or webhook error output (with secrets redacted).
