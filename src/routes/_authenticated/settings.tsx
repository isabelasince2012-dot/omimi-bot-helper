import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Bot, Webhook } from "lucide-react";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings — Pulse" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const qc = useQueryClient();
  const [form, setForm] = useState({
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
              <Input type="password" placeholder="Stored as a secret on the backend" disabled value="••••••••••••" />
              <p className="text-xs text-muted-foreground">Token is held server-side. Ask your developer to set <code className="text-foreground">TELEGRAM_BOT_TOKEN</code> as a secret when wiring the webhook.</p>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Bot username</Label><Input value={form.bot_username} onChange={(e) => setForm({ ...form, bot_username: e.target.value })} placeholder="@your_bot" /></div>
              <div className="space-y-2"><Label>Default timezone</Label><Input value={form.default_timezone} onChange={(e) => setForm({ ...form, default_timezone: e.target.value })} /></div>
            </div>
            <div className="space-y-2">
              <Label><Webhook className="h-3 w-3 inline mr-1" /> Webhook URL</Label>
              <Input value={form.webhook_url} onChange={(e) => setForm({ ...form, webhook_url: e.target.value })} placeholder="https://your-app.lovable.app/api/public/telegram/webhook" />
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
