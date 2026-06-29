import { createFileRoute } from "@tanstack/react-router";

// Public Telegram webhook. Receives updates, registers users, tracks last_active,
// and replies to common commands with professional auto-responses.

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

        const { data: settings } = await supabaseAdmin
          .from("bot_settings")
          .select("bot_token, bot_username")
          .limit(1)
          .maybeSingle();
        const token = settings?.bot_token || process.env.TELEGRAM_BOT_TOKEN;

        if (!token || !message?.chat?.id) return Response.json({ ok: true });

        const send = async (text: string, extra: Record<string, unknown> = {}) => {
          await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: message.chat.id,
              text,
              parse_mode: "HTML",
              disable_web_page_preview: true,
              ...extra,
            }),
          }).catch(() => {});
        };

        const text: string = (message.text ?? "").trim();
        const lower = text.toLowerCase();
        const name = from.first_name ?? "there";
        const cmd = text.startsWith("/") ? text.split(/\s+/)[0].split("@")[0].toLowerCase() : "";

        if (cmd === "/start") {
          await send(
            `👋 <b>Welcome, ${escapeHtml(name)}!</b>\n\n` +
              `You're now subscribed to official updates, announcements and reminders.\n\n` +
              `<b>Available commands</b>\n` +
              `/help — Show all commands\n` +
              `/about — About this service\n` +
              `/status — Your subscription status\n` +
              `/stop — Unsubscribe from messages`,
          );
        } else if (cmd === "/help") {
          await send(
            `<b>Help & Commands</b>\n\n` +
              `/start — Subscribe and get started\n` +
              `/about — Learn more about this bot\n` +
              `/status — Check your subscription\n` +
              `/stop — Pause notifications\n\n` +
              `Need a human? Just reply to this message — our team reviews incoming messages regularly.`,
          );
        } else if (cmd === "/about") {
          await send(
            `<b>About</b>\n\n` +
              `This is the official notification bot. We send broadcasts, announcements and scheduled reminders directly here so you never miss an update.\n\n` +
              `Your data is handled securely and is used only to deliver messages you've subscribed to.`,
          );
        } else if (cmd === "/status") {
          await send(
            `<b>Subscription status</b>\n\n` +
              `• Name: ${escapeHtml([from.first_name, from.last_name].filter(Boolean).join(" ") || "—")}\n` +
              `• Username: ${from.username ? "@" + escapeHtml(from.username) : "—"}\n` +
              `• Status: ✅ Active\n` +
              `• Last seen: just now\n\n` +
              `Send /stop anytime to pause notifications.`,
          );
        } else if (cmd === "/stop") {
          await supabaseAdmin
            .from("telegram_users")
            .update({ status: "inactive" })
            .eq("telegram_id", from.id);
          await send(
            `🔕 You've been unsubscribed.\n\nYou will no longer receive broadcasts. Send /start anytime to resume.`,
          );
        } else if (cmd) {
          await send(
            `I don't recognise <code>${escapeHtml(cmd)}</code>. Send /help to see what I can do.`,
          );
        } else if (text) {
          // Friendly fallback for free-form messages
          if (/\b(hi|hello|hey|hola|salam|selam)\b/i.test(lower)) {
            await send(`Hello ${escapeHtml(name)} 👋 — send /help to see what I can do.`);
          } else if (/\b(thanks|thank you|thx)\b/i.test(lower)) {
            await send(`You're welcome! 🙌`);
          } else {
            await send(
              `✅ Message received. Our team will review it shortly.\n\nIn the meantime, send /help to see available commands.`,
            );
          }
        }

        return Response.json({ ok: true });
      },
    },
  },
});

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
