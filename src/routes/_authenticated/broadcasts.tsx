import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Send, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { format } from "date-fns";
import { useServerFn } from "@tanstack/react-start";
import { sendBroadcast } from "@/lib/telegram.functions";

export const Route = createFileRoute("/_authenticated/broadcasts")({
  head: () => ({ meta: [{ title: "Broadcasts — Pulse" }] }),
  component: BroadcastsPage,
});

function BroadcastsPage() {
  const qc = useQueryClient();
  const dispatch = useServerFn(sendBroadcast);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    title: "",
    message: "",
    media_url: "",
    media_type: "none",
    button_text: "",
    button_url: "",
    audience: "all",
    scheduled_at: "",
  });

  const { data: broadcasts } = useQuery({
    queryKey: ["broadcasts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("broadcasts").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  async function save(status: "draft" | "scheduled" | "sending") {
    if (!form.message.trim()) return toast.error("Message is required");
    const payload: any = {
      title: form.title || null,
      message: form.message,
      media_url: form.media_url || null,
      media_type: form.media_type === "none" ? null : form.media_type,
      button_text: form.button_text || null,
      button_url: form.button_url || null,
      audience: form.audience,
      scheduled_at: form.scheduled_at ? new Date(form.scheduled_at).toISOString() : null,
      status,
    };
    const { data: inserted, error } = await supabase.from("broadcasts").insert(payload).select("id").single();
    if (error) return toast.error(error.message);
    setOpen(false);
    setForm({ title: "", message: "", media_url: "", media_type: "none", button_text: "", button_url: "", audience: "all", scheduled_at: "" });
    qc.invalidateQueries({ queryKey: ["broadcasts"] });

    if (status === "sending" && inserted?.id) {
      const t = toast.loading("Sending broadcast to Telegram...");
      try {
        const res = await dispatch({ data: { broadcastId: inserted.id } });
        toast.success(`Delivered to ${res.sent}/${res.total}${res.failed ? ` · ${res.failed} failed` : ""}`, { id: t });
      } catch (e: any) {
        toast.error(e?.message || "Failed to send broadcast", { id: t });
      }
      qc.invalidateQueries({ queryKey: ["broadcasts"] });
    } else {
      toast.success("Broadcast saved");
    }
  }

  return (
    <div>
      <PageHeader
        title="Broadcasts"
        description="Send messages, media, and link buttons to your Telegram audience."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-2" />New broadcast</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Create broadcast</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Title (internal)</Label>
                  <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Weekly digest" />
                </div>
                <div className="space-y-2">
                  <Label>Message *</Label>
                  <Textarea rows={6} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} placeholder="Write your message... HTML formatting supported." />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Media type</Label>
                    <Select value={form.media_type} onValueChange={(v) => setForm({ ...form, media_type: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        <SelectItem value="photo">Photo</SelectItem>
                        <SelectItem value="video">Video</SelectItem>
                        <SelectItem value="document">Document</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Media URL</Label>
                    <Input value={form.media_url} onChange={(e) => setForm({ ...form, media_url: e.target.value })} placeholder="https://..." />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Button text</Label>
                    <Input value={form.button_text} onChange={(e) => setForm({ ...form, button_text: e.target.value })} placeholder="Read more" />
                  </div>
                  <div className="space-y-2">
                    <Label>Button URL</Label>
                    <Input value={form.button_url} onChange={(e) => setForm({ ...form, button_url: e.target.value })} placeholder="https://..." />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Audience</Label>
                    <Select value={form.audience} onValueChange={(v) => setForm({ ...form, audience: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All users</SelectItem>
                        <SelectItem value="active">Active users only</SelectItem>
                        <SelectItem value="selected">Selected users</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Schedule (optional)</Label>
                    <Input type="datetime-local" value={form.scheduled_at} onChange={(e) => setForm({ ...form, scheduled_at: e.target.value })} />
                  </div>
                </div>

                {form.message && (
                  <Card className="bg-muted/40 border-border">
                    <CardContent className="p-4">
                      <p className="text-xs text-muted-foreground mb-2">Preview</p>
                      <p className="text-sm whitespace-pre-wrap">{form.message}</p>
                      {form.button_text && (
                        <Button size="sm" variant="secondary" className="mt-3">{form.button_text}</Button>
                      )}
                    </CardContent>
                  </Card>
                )}
              </div>
              <DialogFooter className="gap-2">
                <Button variant="ghost" onClick={() => save("draft")}>Save draft</Button>
                {form.scheduled_at ? (
                  <Button onClick={() => save("scheduled")}>Schedule</Button>
                ) : (
                  <Button onClick={() => save("sending")}><Send className="h-4 w-4 mr-2" />Send now</Button>
                )}
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="grid gap-3">
        {(broadcasts ?? []).length === 0 && (
          <Card className="surface-card p-12 text-center">
            <p className="text-muted-foreground">No broadcasts yet. Create your first one.</p>
          </Card>
        )}
        {broadcasts?.map((b) => (
          <Card key={b.id} className="surface-card">
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-medium truncate">{b.title || "Untitled broadcast"}</p>
                    <StatusBadge status={b.status} />
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2">{b.message}</p>
                  <div className="flex gap-4 mt-3 text-xs text-muted-foreground">
                    <span>Audience: <span className="text-foreground">{b.audience}</span></span>
                    <span>Sent: <span className="text-success">{b.sent_count}</span></span>
                    <span>Failed: <span className="text-destructive">{b.failed_count}</span></span>
                    <span>{format(new Date(b.created_at), "MMM d, yyyy HH:mm")}</span>
                  </div>
                </div>
                <Button size="sm" variant="outline" onClick={async () => {
                  const t = toast.loading("Sending...");
                  try {
                    const res = await dispatch({ data: { broadcastId: b.id } });
                    toast.success(`Delivered to ${res.sent}/${res.total}${res.failed ? ` · ${res.failed} failed` : ""}`, { id: t });
                    qc.invalidateQueries({ queryKey: ["broadcasts"] });
                  } catch (e: any) {
                    toast.error(e?.message || "Failed", { id: t });
                  }
                }}><Send className="h-3.5 w-3.5 mr-1.5" />{b.status === "sent" ? "Resend" : "Send now"}</Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    draft: "bg-muted text-muted-foreground",
    scheduled: "bg-warning/15 text-warning border-warning/30",
    sending: "bg-primary/15 text-primary border-primary/30",
    sent: "bg-success/15 text-success border-success/30",
    failed: "bg-destructive/15 text-destructive border-destructive/30",
  };
  return <Badge variant="outline" className={map[status] || ""}>{status}</Badge>;
}
