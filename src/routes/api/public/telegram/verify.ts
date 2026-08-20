import { createFileRoute } from "@tanstack/react-router";

// Public reachability probe. Returns no secrets — only whether this deployment
// is up and whether a bot token / webhook secret is configured.
export const Route = createFileRoute("/api/public/telegram/verify")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: settings } = await supabaseAdmin
          .from("bot_settings")
          .select("bot_username, webhook_url, bot_token")
          .limit(1)
          .maybeSingle();

        return Response.json({
          ok: true,
          service: "tele-bot",
          reachable: true,
          webhook_endpoint: `${url.origin}/api/public/telegram/webhook`,
          configured_webhook_url: settings?.webhook_url || null,
          bot_username: settings?.bot_username || null,
          token_configured: Boolean(settings?.bot_token || process.env.TELEGRAM_BOT_TOKEN),
          secret_required: Boolean(process.env.TELEGRAM_WEBHOOK_SECRET),
          time: new Date().toISOString(),
        });
      },
      // Accepts a simulated Telegram update so you can confirm end-to-end delivery
      // without waiting on a real user message. Never writes to the database.
      POST: async ({ request }) => {
        const body = await request.json().catch(() => null);
        return Response.json({
          ok: true,
          received: Boolean(body),
          echo: body?.message?.text ?? null,
          note: "Payload received successfully. This endpoint does not store data.",
        });
      },
    },
  },
});
