export type WorkspaceSettings = {
  id: string;
  bot_token: string | null;
  bot_username: string | null;
  webhook_url: string | null;
  webhook_token: string;
};

export async function loadOwnSettings(context: {
  supabase: { from: (table: string) => any };
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