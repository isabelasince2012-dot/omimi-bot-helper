import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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

    const token = settings?.bot_token || process.env.TELEGRAM_BOT_TOKEN;
    if (!token) throw new Error("No bot token configured");

    const res = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    const json = (await res.json()) as { ok: boolean; result?: { username: string; first_name: string; id: number }; description?: string };
    if (!json.ok) throw new Error(json.description || "Telegram API error");
    return { username: json.result!.username, first_name: json.result!.first_name, id: json.result!.id };
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
