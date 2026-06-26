import { createFileRoute } from "@tanstack/react-router";

// Public Telegram webhook. Receives updates from Telegram, registers users,
// and tracks last_active. The bot token is stored as a Lovable Cloud secret
// (TELEGRAM_BOT_TOKEN). Set the webhook in BotFather/setWebhook to:
//   https://<your-app>/api/public/telegram/webhook
//
// Optional shared secret: set X-Telegram-Bot-Api-Secret-Token in Telegram and
// compare here against process.env.TELEGRAM_WEBHOOK_SECRET if present.

export const Route = createFileRoute("/api/public/telegram/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
        if (expectedSecret) {
          const got = request.headers.get("x-telegram-bot-api-secret-token") ?? "";
          if (got !== expectedSecret) return new Response("Unauthorized", { status: 401 });
        }

        const update = await request.json().catch(() => null);
        if (!update) return Response.json({ ok: true });

        const message = update.message ?? update.edited_message ?? update.channel_post;
        const from = message?.from ?? update.callback_query?.from;
        if (!from?.id) return Response.json({ ok: true });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const now = new Date().toISOString();
        await supabaseAdmin
          .from("telegram_users")
          .upsert(
            {
              telegram_id: from.id,
              username: from.username ?? null,
              first_name: from.first_name ?? null,
              last_name: from.last_name ?? null,
              language: from.language_code ?? null,
              status: "active",
              last_active: now,
            },
            { onConflict: "telegram_id" },
          );

        // Auto-greet on /start
        if (message?.text === "/start") {
          const token = process.env.TELEGRAM_BOT_TOKEN;
          if (token) {
            await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chat_id: message.chat.id,
                text: `Hi ${from.first_name ?? "there"}! You're subscribed to updates.`,
              }),
            }).catch(() => {});
          }
        }

        return Response.json({ ok: true });
      },
    },
  },
});
