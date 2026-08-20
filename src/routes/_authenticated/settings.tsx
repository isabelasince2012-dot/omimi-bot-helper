import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { testBot, setWebhook, validateTokenFormat } from "@/lib/telegram.functions";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Bot, Webhook, Zap, Link2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings — tele-bot" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const qc = useQueryClient();
  const test = useServerFn(testBot);
  const register = useServerFn(setWebhook);
  const [testing, setTesting] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [form, setForm] = useState({
    bot_token: "",
    bot_username: "",
    webhook_url: "",
    default_timezone: "UTC",
    rate_limit: 30,
    retry_attempts: 3,
    notification_sound: true,
  });
  const [id, setId] = useState<string | null>(null);

  const { data } = useQuery({
    queryKey: ["bot-settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("bot_settings").select("*").limit(1).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (data) {
      setId(data.id);
      setForm({
        bot_token: data.bot_token ?? "",
        bot_username: data.bot_username ?? "",
        webhook_url: data.webhook_url ?? "",
        default_timezone: data.default_timezone,
        rate_limit: data.rate_limit,
        retry_attempts: data.retry_attempts,
        notification_sound: data.notification_sound,
      });
    }
  }, [data]);

  async function save() {
    if (!id) return;
    const { error } = await supabase.from("bot_settings").update(form).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Settings saved");
    qc.invalidateQueries({ queryKey: ["bot-settings"] });
  }

  async function handleTest() {
    const formatErr = validateTokenFormat(form.bot_token);
    if (formatErr) return toast.error(formatErr);
    setTesting(true);
    try {
      if (id) await supabase.from("bot_settings").update({ bot_token: form.bot_token.trim() }).eq("id", id);
      const res = await test();
      toast.success(`Connected to @${res.username} (${res.first_name})`, {
        description:
          (res.webhook_url ? `Webhook: ${res.webhook_url}` : "No webhook registered yet") +
          ` · ${res.pending_updates} pending`,
      });
      if (res.missing_permissions.length) {
        toast.warning(`Missing permissions: ${res.missing_permissions.join(", ")}`, {
          description: "Open @BotFather → /mybots → Bot Settings to enable.",
        });
      }
      for (const w of res.warnings) toast.warning(w);
      if (!form.bot_username) setForm((f) => ({ ...f, bot_username: `@${res.username}` }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Test failed");
    } finally {
      setTesting(false);
    }
  }


  async function handleRegisterWebhook() {
    if (!form.webhook_url) return toast.error("Set a webhook URL first");
    setRegistering(true);
    try {
      await register({ data: { url: form.webhook_url } });
      toast.success("Webhook registered with Telegram");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to register webhook");
    } finally {
      setRegistering(false);
    }
  }

  return (
    <div>
      <PageHeader title="Settings" description="Configure your Telegram bot and broadcast behavior." />

      <div className="grid gap-6 max-w-3xl">
        <Card className="surface-card">
          <CardHeader>
            <CardTitle className="text-base font-medium flex items-center gap-2"><Bot className="h-4 w-4 text-primary" /> Telegram bot</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Bot token</Label>
              <div className="flex gap-2">
                <Input
                  type="password"
                  placeholder="123456:ABC-DEF..."
                  value={form.bot_token}
                  onChange={(e) => setForm({ ...form, bot_token: e.target.value })}
                />
                <Button variant="outline" onClick={handleTest} disabled={testing || !form.bot_token}>
                  <Zap className="h-3.5 w-3.5 mr-1.5" />
                  {testing ? "Testing..." : "Test bot"}
                </Button>
              </div>
              {form.bot_token && validateTokenFormat(form.bot_token) ? (
                <p className="text-xs text-destructive">{validateTokenFormat(form.bot_token)}</p>
              ) : (
                <p className="text-xs text-muted-foreground">Get this from @BotFather. Stored securely; only admins can read or change it.</p>
              )}

            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Bot username</Label><Input value={form.bot_username} onChange={(e) => setForm({ ...form, bot_username: e.target.value })} placeholder="@your_bot" /></div>
              <div className="space-y-2"><Label>Default timezone</Label><Input value={form.default_timezone} onChange={(e) => setForm({ ...form, default_timezone: e.target.value })} /></div>
            </div>
            <div className="space-y-2">
              <Label><Webhook className="h-3 w-3 inline mr-1" /> Webhook URL</Label>
              <div className="flex gap-2">
                <Input value={form.webhook_url} onChange={(e) => setForm({ ...form, webhook_url: e.target.value })} placeholder="https://your-app.lovable.app/api/public/telegram/webhook" />
                <Button variant="outline" onClick={handleRegisterWebhook} disabled={registering || !form.webhook_url || !form.bot_token}>
                  <Link2 className="h-3.5 w-3.5 mr-1.5" />
                  {registering ? "Registering..." : "Register"}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">Click Register to tell Telegram to send updates to this URL.</p>
            </div>
          </CardContent>
        </Card>

        <Card className="surface-card">
          <CardHeader><CardTitle className="text-base font-medium">Broadcast behavior</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Rate limit (msgs/sec)</Label><Input type="number" min={1} max={30} value={form.rate_limit} onChange={(e) => setForm({ ...form, rate_limit: +e.target.value })} /></div>
              <div className="space-y-2"><Label>Retry attempts</Label><Input type="number" min={0} max={10} value={form.retry_attempts} onChange={(e) => setForm({ ...form, retry_attempts: +e.target.value })} /></div>
            </div>
            <div className="flex items-center justify-between rounded-md border border-border p-3">
              <div><p className="text-sm font-medium">Notification sound</p><p className="text-xs text-muted-foreground">Play sound when broadcasts complete.</p></div>
              <Switch checked={form.notification_sound} onCheckedChange={(v) => setForm({ ...form, notification_sound: v })} />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end"><Button onClick={save}>Save settings</Button></div>
      </div>
    </div>
  );
}
