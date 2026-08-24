import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const TOKEN_REGEX = /^\d{6,12}:[A-Za-z0-9_-]{30,}$/;

export function validateTokenFormat(token: string): string | null {
  if (!token || !token.trim()) return "Bot token is required";
  if (!TOKEN_REGEX.test(token.trim())) {
    return "Invalid token format. Expected '<bot_id>:<secret>' from @BotFather";
  }
  return null;
}

type WorkspaceSettings = {
  id: string;
  bot_token: string | null;
  bot_username: string | null;
  webhook_url: string | null;
  webhook_token: string;
};

/** Loads the signed-in account's own workspace settings (RLS-scoped). */
async function loadOwnSettings(context: {
  supabase: { from: (t: string) => any };
  userId: string;
}): Promise<WorkspaceSettings> {
  const { data, error } = await context.supabase
    .from("bot_settings")
    .select("id, bot_token, bot_username, webhook_url, webhook_token")
    .eq("owner_id", context.userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Workspace not initialised. Reload the page and try again.");
  return data as WorkspaceSettings;
}

export const getWorkspace = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const s = await loadOwnSettings(context);
    return {
      id: s.id,
      bot_username: s.bot_username,
      webhook_token: s.webhook_token,
      has_token: Boolean(s.bot_token),
    };
  });

export const testBot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const settings = await loadOwnSettings(context);

    const token = (settings.bot_token || "").trim();
    if (!token) throw new Error("No bot token configured. Paste a token from @BotFather first.");
    const formatErr = validateTokenFormat(token);
    if (formatErr) throw new Error(formatErr);

    let meRes: Response;
    try {
      meRes = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    } catch {
      throw new Error("Could not reach api.telegram.org. Check network or firewall.");
    }
    const me = (await meRes.json()) as {
      ok: boolean;
      error_code?: number;
      description?: string;
      result?: { id: number; username: string; first_name: string; can_join_groups?: boolean };
    };
    if (!me.ok) {
      if (me.error_code === 401) throw new Error("Token rejected by Telegram (401 Unauthorized). The bot token is invalid or has been revoked — regenerate it in @BotFather.");
      if (me.error_code === 404) throw new Error("Bot not found (404). The token does not match any bot.");
      throw new Error(`Telegram rejected the token: ${me.description || "unknown error"}`);
    }

    const whRes = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`);
    const wh = (await whRes.json()) as { ok: boolean; result?: { url: string; last_error_message?: string; pending_update_count: number } };

    const missing: string[] = [];
    if (me.result?.can_join_groups === false) missing.push("join groups");
    const warnings: string[] = [];
    if (wh.ok && wh.result?.last_error_message) {
      warnings.push(`Webhook delivery error: ${wh.result.last_error_message}`);
    }

    // Remember the bot username for this workspace
    if (me.result?.username) {
      await context.supabase
        .from("bot_settings")
        .update({ bot_username: me.result.username })
        .eq("id", settings.id);
    }

    return {
      id: me.result!.id,
      username: me.result!.username,
      first_name: me.result!.first_name,
      webhook_url: wh.result?.url || null,
      pending_updates: wh.result?.pending_update_count ?? 0,
      missing_permissions: missing,
      warnings,
    };
  });

export const verifyWebhook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { url?: string }) => input)
  .handler(async ({ data, context }) => {
    const settings = await loadOwnSettings(context);

    const token = (settings.bot_token || "").trim();
    if (!token) throw new Error("No bot token configured. Paste a token from @BotFather first.");

    const target = (data.url || settings.webhook_url || "").trim();

    const whRes = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`);
    const wh = (await whRes.json()) as {
      ok: boolean;
      description?: string;
      result?: {
        url: string;
        pending_update_count: number;
        last_error_message?: string;
        ip_address?: string;
      };
    };
    if (!wh.ok) throw new Error(wh.description || "Telegram rejected the request");

    const registeredUrl = wh.result?.url || "";

    let reachable = false;
    let reachStatus: number | null = null;
    let reachError: string | null = null;
    const probeUrl = registeredUrl || target;
    if (probeUrl) {
      try {
        const probe = await fetch(probeUrl, { method: "GET" });
        reachStatus = probe.status;
        reachable = probe.status < 500;
      } catch (e) {
        reachError = e instanceof Error ? e.message : "Request failed";
      }
    }

    let testDelivery: "ok" | "failed" | "skipped" = "skipped";
    if (probeUrl) {
      try {
        const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
        const res = await fetch(probeUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(secret ? { "x-telegram-bot-api-secret-token": secret } : {}),
          },
          body: JSON.stringify({ update_id: 0, __test: true }),
        });
        testDelivery = res.ok ? "ok" : "failed";
      } catch {
        testDelivery = "failed";
      }
    }

    return {
      registered_url: registeredUrl || null,
      matches_configured: Boolean(target) && registeredUrl === target,
      pending_updates: wh.result?.pending_update_count ?? 0,
      last_error: wh.result?.last_error_message || null,
      ip_address: wh.result?.ip_address || null,
      reachable,
      reach_status: reachStatus,
      reach_error: reachError,
      test_delivery: testDelivery,
    };
  });

export const setWebhook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { url: string }) => input)
  .handler(async ({ data, context }) => {
    const settings = await loadOwnSettings(context);
    const token = (settings.bot_token || "").trim();
    if (!token) throw new Error("No bot token configured");

    // The URL must be this workspace's own webhook path.
    if (!data.url.includes(settings.webhook_token)) {
      throw new Error("Use your own webhook URL shown in Settings.");
    }

    const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: data.url, allowed_updates: ["message", "edited_message", "callback_query"] }),
    });
    const json = (await res.json()) as { ok: boolean; description?: string };
    if (!json.ok) throw new Error(json.description || "Failed to set webhook");

    await context.supabase.from("bot_settings").update({ webhook_url: data.url }).eq("id", settings.id);
    return { ok: true };
  });

export const sendBroadcast = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { broadcastId: string }) => input)
  .handler(async ({ data, context }) => {
    const settings = await loadOwnSettings(context);
    const token = (settings.bot_token || "").trim();
    if (!token) throw new Error("No bot token configured. Set it in Settings.");

    const ownerId = context.userId;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: b, error: bErr } = await supabaseAdmin
      .from("broadcasts")
      .select("*")
      .eq("id", data.broadcastId)
      .eq("owner_id", ownerId)
      .single();
    if (bErr || !b) throw new Error(bErr?.message || "Broadcast not found");

    let q = supabaseAdmin
      .from("telegram_users")
      .select("id, telegram_id, status")
      .eq("owner_id", ownerId);
    if (b.audience === "active") {
      q = q.eq("status", "active");
    } else if (b.audience === "new") {
      const days = Math.max(1, Number(b.audience_days) || 7);
      const since = new Date(Date.now() - days * 86400_000).toISOString();
      q = q.gte("created_at", since);
    } else if (b.audience === "selected") {
      const ids: string[] = Array.isArray(b.audience_user_ids) ? b.audience_user_ids : [];
      if (ids.length === 0) {
        await supabaseAdmin.from("broadcasts").update({ status: "sent", sent_count: 0, failed_count: 0 }).eq("id", b.id);
        return { sent: 0, failed: 0, total: 0 };
      }
      q = q.in("id", ids);
    }
    const { data: users, error: uErr } = await q;
    if (uErr) throw new Error(uErr.message);
    if (!users || users.length === 0) {
      await supabaseAdmin.from("broadcasts").update({ status: "sent", sent_count: 0, failed_count: 0 }).eq("id", b.id);
      return { sent: 0, failed: 0, total: 0 };
    }

    await supabaseAdmin.from("broadcasts").update({ status: "sending" }).eq("id", b.id);

    const reply_markup = b.button_text && b.button_url
      ? { inline_keyboard: [[{ text: b.button_text, url: b.button_url }]] }
      : undefined;

    let sent = 0;
    let failed = 0;
    const logs: any[] = [];

    for (const u of users) {
      try {
        let endpoint = "sendMessage";
        let body: any = { chat_id: u.telegram_id, text: b.message, parse_mode: "HTML" };
        if (reply_markup) body.reply_markup = reply_markup;

        if (b.media_url && b.media_type && b.media_type !== "none") {
          if (b.media_type === "photo") {
            endpoint = "sendPhoto";
            body = { chat_id: u.telegram_id, photo: b.media_url, caption: b.message, parse_mode: "HTML" };
          } else if (b.media_type === "video") {
            endpoint = "sendVideo";
            body = { chat_id: u.telegram_id, video: b.media_url, caption: b.message, parse_mode: "HTML" };
          } else if (b.media_type === "document") {
            endpoint = "sendDocument";
            body = { chat_id: u.telegram_id, document: b.media_url, caption: b.message, parse_mode: "HTML" };
          }
          if (reply_markup) body.reply_markup = reply_markup;
        }

        const res = await fetch(`https://api.telegram.org/bot${token}/${endpoint}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const json = (await res.json()) as { ok: boolean; description?: string };
        if (json.ok) {
          sent++;
          logs.push({ owner_id: ownerId, telegram_user_id: u.id, source_type: "broadcast", source_id: b.id, status: "sent" });
        } else {
          failed++;
          logs.push({ owner_id: ownerId, telegram_user_id: u.id, source_type: "broadcast", source_id: b.id, status: "failed", error: json.description || "unknown" });
        }
      } catch (e: any) {
        failed++;
        logs.push({ owner_id: ownerId, telegram_user_id: u.id, source_type: "broadcast", source_id: b.id, status: "failed", error: e?.message || "network error" });
      }
      await new Promise((r) => setTimeout(r, 40));
    }

    if (logs.length) {
      await supabaseAdmin.from("message_logs").insert(logs).then(() => {}, () => {});
    }

    await supabaseAdmin
      .from("broadcasts")
      .update({ status: failed === users.length ? "failed" : "sent", sent_count: sent, failed_count: failed })
      .eq("id", b.id);

    return { sent, failed, total: users.length };
  });

export const replyToInboxMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { messageId: string; text: string }) => input)
  .handler(async ({ data, context }) => {
    const settings = await loadOwnSettings(context);
    const token = (settings.bot_token || "").trim();
    if (!token) throw new Error("No bot token configured. Set it in Settings.");

    const text = (data.text || "").trim();
    if (!text) throw new Error("Reply text is required");

    const ownerId = context.userId;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: msg, error: mErr } = await supabaseAdmin
      .from("inbox_messages")
      .select("*")
      .eq("id", data.messageId)
      .eq("owner_id", ownerId)
      .single();
    if (mErr || !msg) throw new Error(mErr?.message || "Message not found");

    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: msg.chat_id,
        text,
        parse_mode: "HTML",
        reply_to_message_id: msg.message_id ?? undefined,
        allow_sending_without_reply: true,
      }),
    });
    const json = (await res.json()) as { ok: boolean; description?: string };
    if (!json.ok) throw new Error(json.description || "Telegram rejected the reply");

    await supabaseAdmin.from("inbox_messages").update({ is_read: true }).eq("id", msg.id);
    await supabaseAdmin.from("message_logs").insert({
      owner_id: ownerId,
      telegram_user_id: msg.telegram_user_id,
      source_type: "reply",
      source_id: msg.id,
      status: "sent",
    }).then(() => {}, () => {});

    return { ok: true };
  });
