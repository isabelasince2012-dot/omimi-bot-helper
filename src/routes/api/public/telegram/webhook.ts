import { createFileRoute } from "@tanstack/react-router";

// Public Telegram webhook. Receives updates, registers users, tracks last_active,
// stores direct user messages in the inbox, and replies with polished UI.

export const Route = createFileRoute("/api/public/telegram/webhook")({
  server: {
    handlers: {
      // Quick browser/curl check that Telegram can reach this endpoint.
      GET: async ({ request }) =>
        Response.json({
          ok: true,
          endpoint: new URL(request.url).origin + "/api/public/telegram/webhook",
          method_expected: "POST",
          secret_required: Boolean(process.env.TELEGRAM_WEBHOOK_SECRET),
          time: new Date().toISOString(),
        }),
      POST: async ({ request }) => {
        const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
        if (expectedSecret) {
          const got = request.headers.get("x-telegram-bot-api-secret-token") ?? "";
          if (got !== expectedSecret) return new Response("Unauthorized", { status: 401 });
        }

        const update = await request.json().catch(() => null);
        if (!update) return Response.json({ ok: true });

        const callback = update.callback_query;
        const message = update.message ?? update.edited_message ?? update.channel_post ?? callback?.message;
        const from = update.message?.from ?? update.edited_message?.from ?? callback?.from;
        if (!from?.id) return Response.json({ ok: true });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const now = new Date().toISOString();
        const { data: tgUser } = await supabaseAdmin
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
          )
          .select("id")
          .maybeSingle();

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

        const answerCallback = async (text?: string) => {
          if (!callback?.id) return;
          await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ callback_query_id: callback.id, text: text ?? "" }),
          }).catch(() => {});
        };

        // Polished inline menu shown after /start and on /help
        const mainMenu = {
          inline_keyboard: [
            [
              { text: "📣 Latest updates", callback_data: "menu:updates" },
              { text: "🔔 Notifications", callback_data: "menu:notifications" },
            ],
            [
              { text: "👤 My status", callback_data: "menu:status" },
              { text: "❓ Help", callback_data: "menu:help" },
            ],
            [{ text: "✉️ Contact support", callback_data: "menu:contact" }],
          ],
        };

        const name = from.first_name ?? "there";

        // ---- Callback (button) handling ----
        if (callback?.data) {
          const data = callback.data as string;
          if (data === "menu:updates") {
            await answerCallback();
            await send(
              `📣 <b>Latest updates</b>\n\nYou're subscribed — new broadcasts and announcements will appear here automatically.`,
              { reply_markup: mainMenu },
            );
          } else if (data === "menu:notifications") {
            await answerCallback();
            await send(
              `🔔 <b>Notifications</b>\n\nUse the buttons below to manage your subscription.`,
              {
                reply_markup: {
                  inline_keyboard: [
                    [{ text: "⏸ Pause", callback_data: "sub:pause" }, { text: "▶️ Resume", callback_data: "sub:resume" }],
                    [{ text: "↩️ Back", callback_data: "menu:home" }],
                  ],
                },
              },
            );
          } else if (data === "menu:status") {
            await answerCallback();
            await send(statusText(from), { reply_markup: mainMenu });
          } else if (data === "menu:help") {
            await answerCallback();
            await send(helpText(), { reply_markup: mainMenu });
          } else if (data === "menu:contact") {
            await answerCallback();
            await send(
              `✉️ <b>Contact support</b>\n\nJust reply to this chat with your message — our team will see it in the dashboard and get back to you.`,
              { reply_markup: mainMenu },
            );
          } else if (data === "menu:home") {
            await answerCallback();
            await send(welcomeText(name), { reply_markup: mainMenu });
          } else if (data === "sub:pause") {
            await supabaseAdmin.from("telegram_users").update({ status: "inactive" }).eq("telegram_id", from.id);
            await answerCallback("Notifications paused");
            await send(`🔕 Notifications paused. Tap <b>Resume</b> anytime.`, { reply_markup: mainMenu });
          } else if (data === "sub:resume") {
            await supabaseAdmin.from("telegram_users").update({ status: "active" }).eq("telegram_id", from.id);
            await answerCallback("Notifications resumed");
            await send(`🔔 Notifications resumed. Welcome back!`, { reply_markup: mainMenu });
          } else {
            await answerCallback();
          }
          return Response.json({ ok: true });
        }

        const text: string = (message.text ?? "").trim();
        const lower = text.toLowerCase();
        const cmd = text.startsWith("/") ? text.split(/\s+/)[0].split("@")[0].toLowerCase() : "";

        if (cmd === "/start") {
          await send(welcomeText(name), { reply_markup: mainMenu });
        } else if (cmd === "/help" || cmd === "/menu") {
          await send(helpText(), { reply_markup: mainMenu });
        } else if (cmd === "/about") {
          await send(
            `<b>About</b>\n\nThis is the official notification bot. We send broadcasts, announcements and scheduled reminders directly here so you never miss an update.\n\nYour data is handled securely and is used only to deliver messages you've subscribed to.`,
            { reply_markup: mainMenu },
          );
        } else if (cmd === "/status") {
          await send(statusText(from), { reply_markup: mainMenu });
        } else if (cmd === "/stop") {
          await supabaseAdmin.from("telegram_users").update({ status: "inactive" }).eq("telegram_id", from.id);
          await send(`🔕 You've been unsubscribed.\n\nSend /start anytime to resume.`);
        } else if (cmd) {
          await send(
            `I don't recognise <code>${escapeHtml(cmd)}</code>. Tap a button below or send /help.`,
            { reply_markup: mainMenu },
          );
        } else if (text) {
          // Save direct user message to inbox for admin review
          await supabaseAdmin.from("inbox_messages").insert({
            telegram_user_id: tgUser?.id ?? null,
            telegram_id: from.id,
            username: from.username ?? null,
            first_name: from.first_name ?? null,
            last_name: from.last_name ?? null,
            chat_id: message.chat.id,
            message_id: message.message_id ?? null,
            text,
          });

          if (/\b(hi|hello|hey|hola|salam|selam)\b/i.test(lower)) {
            await send(`Hello ${escapeHtml(name)} 👋 — tap a button to get started.`, { reply_markup: mainMenu });
          } else if (/\b(thanks|thank you|thx)\b/i.test(lower)) {
            await send(`You're welcome! 🙌`);
          } else {
            await send(
              `✅ Message received — our team will review it shortly.\n\nIn the meantime, here's the menu:`,
              { reply_markup: mainMenu },
            );
          }
        }

        return Response.json({ ok: true });
      },
    },
  },
});

function welcomeText(name: string): string {
  return (
    `👋 <b>Welcome, ${escapeHtml(name)}!</b>\n\n` +
    `You're now subscribed to official updates, announcements and reminders.\n\n` +
    `Tap a button below to get started — or send /help anytime.`
  );
}

function helpText(): string {
  return (
    `<b>Help &amp; Commands</b>\n\n` +
    `/start — Open the main menu\n` +
    `/menu — Show menu buttons\n` +
    `/about — Learn more about this bot\n` +
    `/status — Your subscription status\n` +
    `/stop — Unsubscribe from notifications\n\n` +
    `Need a human? Just send a message — our team reads every reply.`
  );
}

function statusText(from: { first_name?: string; last_name?: string; username?: string }): string {
  return (
    `<b>👤 Your status</b>\n\n` +
    `• Name: ${escapeHtml([from.first_name, from.last_name].filter(Boolean).join(" ") || "—")}\n` +
    `• Username: ${from.username ? "@" + escapeHtml(from.username) : "—"}\n` +
    `• Status: ✅ Active\n` +
    `• Last seen: just now\n\n` +
    `Tap <b>Notifications</b> to pause or resume.`
  );
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
