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

export const testBot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");

    const { data: settings } = await context.supabase
      .from("bot_settings")
      .select("bot_token")
      .limit(1)
      .maybeSingle();

    const token = (settings?.bot_token || process.env.TELEGRAM_BOT_TOKEN || "").trim();
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
      result?: { id: number; username: string; first_name: string; can_join_groups?: boolean; can_read_all_group_messages?: boolean; supports_inline_queries?: boolean };
    };
    if (!me.ok) {
      if (me.error_code === 401) throw new Error("Token rejected by Telegram (401 Unauthorized). The bot token is invalid or has been revoked — regenerate it in @BotFather.");
      if (me.error_code === 404) throw new Error("Bot not found (404). The token does not match any bot.");
      throw new Error(`Telegram rejected the token: ${me.description || "unknown error"}`);
    }

    // Check webhook + permissions
    const whRes = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`);
    const wh = (await whRes.json()) as { ok: boolean; result?: { url: string; last_error_message?: string; pending_update_count: number } };

    const missing: string[] = [];
    if (me.result?.can_join_groups === false) missing.push("join groups");
    // Telegram requires sending messages — getMe success implies that works. Surface webhook issues:
    const warnings: string[] = [];
    if (wh.ok && wh.result?.last_error_message) {
      warnings.push(`Webhook delivery error: ${wh.result.last_error_message}`);
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


export const setWebhook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { url: string }) => input)
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");

    const { data: settings } = await context.supabase
      .from("bot_settings")
      .select("bot_token")
      .limit(1)
      .maybeSingle();

    const token = settings?.bot_token || process.env.TELEGRAM_BOT_TOKEN;
    if (!token) throw new Error("No bot token configured");

    const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: data.url, allowed_updates: ["message", "edited_message", "callback_query"] }),
    });
    const json = (await res.json()) as { ok: boolean; description?: string };
    if (!json.ok) throw new Error(json.description || "Failed to set webhook");
    return { ok: true };
  });
