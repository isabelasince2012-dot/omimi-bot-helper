import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Inbox, Search, Trash2, Check, CheckCheck, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/inbox")({
  head: () => ({ meta: [{ title: "Inbox — Pulse" }] }),
  component: InboxPage,
});

function InboxPage() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "unread">("all");

  const { data: messages, isLoading } = useQuery({
    queryKey: ["inbox-messages"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inbox_messages")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 15000,
  });

  const filtered = (messages ?? []).filter((m) => {
    if (filter === "unread" && m.is_read) return false;
    if (!q) return true;
    const hay = `${m.text} ${m.username ?? ""} ${m.first_name ?? ""} ${m.last_name ?? ""}`.toLowerCase();
    return hay.includes(q.toLowerCase());
  });

  const unreadCount = (messages ?? []).filter((m) => !m.is_read).length;

  async function markRead(id: string, value: boolean) {
    const { error } = await supabase.from("inbox_messages").update({ is_read: value }).eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["inbox-messages"] });
  }

  async function markAllRead() {
    const { error } = await supabase.from("inbox_messages").update({ is_read: true }).eq("is_read", false);
    if (error) return toast.error(error.message);
    toast.success("All messages marked as read");
    qc.invalidateQueries({ queryKey: ["inbox-messages"] });
  }

  async function remove(id: string) {
    if (!confirm("Delete this message?")) return;
    const { error } = await supabase.from("inbox_messages").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Message deleted");
    qc.invalidateQueries({ queryKey: ["inbox-messages"] });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inbox"
        description="Direct messages users send to your Telegram bot."
        actions={
          <Button variant="outline" onClick={markAllRead} disabled={!unreadCount}>
            <CheckCheck className="h-4 w-4 mr-2" /> Mark all read
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search messages or users" className="pl-9" />
        </div>
        <div className="flex gap-1 rounded-md border border-border p-1 bg-card">
          <Button size="sm" variant={filter === "all" ? "secondary" : "ghost"} onClick={() => setFilter("all")}>
            All
          </Button>
          <Button size="sm" variant={filter === "unread" ? "secondary" : "ghost"} onClick={() => setFilter("unread")}>
            Unread {unreadCount > 0 && <Badge className="ml-2" variant="default">{unreadCount}</Badge>}
          </Button>
        </div>
      </div>

      {isLoading ? (
        <Card className="p-10 text-center text-muted-foreground">Loading…</Card>
      ) : filtered.length === 0 ? (
        <Card className="p-12 text-center">
          <Inbox className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="font-medium">No messages yet</p>
          <p className="text-sm text-muted-foreground mt-1">
            When users send your bot a direct message, it will appear here.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((m) => {
            const display = [m.first_name, m.last_name].filter(Boolean).join(" ") || m.username || `#${m.telegram_id}`;
            const initial = (display[0] ?? "?").toUpperCase();
            return (
              <Card key={m.id} className={`p-4 transition-colors ${m.is_read ? "" : "border-primary/40 bg-primary/[0.02]"}`}>
                <div className="flex items-start gap-3">
                  <div
                    className="h-10 w-10 rounded-full flex items-center justify-center text-sm font-semibold shrink-0 text-primary-foreground"
                    style={{ background: "var(--gradient-primary)" }}
                  >
                    {initial}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium truncate">{display}</p>
                      {m.username && <span className="text-xs text-muted-foreground">@{m.username}</span>}
                      {!m.is_read && <Badge variant="default" className="h-5">New</Badge>}
                      <span className="text-xs text-muted-foreground ml-auto">
                        {formatDistanceToNow(new Date(m.created_at), { addSuffix: true })}
                      </span>
                    </div>
                    <p className="mt-2 text-sm whitespace-pre-wrap break-words flex items-start gap-2">
                      <MessageSquare className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                      <span>{m.text}</span>
                    </p>
                    <div className="mt-3 flex gap-2">
                      <Button size="sm" variant="ghost" onClick={() => markRead(m.id, !m.is_read)}>
                        <Check className="h-4 w-4 mr-1" /> {m.is_read ? "Mark unread" : "Mark read"}
                      </Button>
                      <Button size="sm" variant="ghost" className="text-destructive" onClick={() => remove(m.id)}>
                        <Trash2 className="h-4 w-4 mr-1" /> Delete
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
