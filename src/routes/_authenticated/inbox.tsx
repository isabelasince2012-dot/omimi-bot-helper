import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import {
  Inbox,
  Search,
  Trash2,
  Check,
  CheckCheck,
  MessageSquare,
  Reply,
  Send,
  Sparkles,
  Plus,
  Pencil,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { replyToInboxMessage } from "@/lib/telegram.functions";

export const Route = createFileRoute("/_authenticated/inbox")({
  head: () => ({ meta: [{ title: "Inbox — tele-bot" }] }),
  component: InboxPage,
});

type InboxMessage = {
  id: string;
  telegram_user_id: string | null;
  telegram_id: number;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  chat_id: number;
  message_id: number | null;
  text: string;
  is_read: boolean;
  created_at: string;
};

type Template = {
  id: string;
  title: string;
  content: string;
};

function applyVars(text: string, m: InboxMessage): string {
  const name = m.first_name || m.username || "there";
  const full = [m.first_name, m.last_name].filter(Boolean).join(" ") || m.username || "there";
  return text
    .replace(/\{name\}/gi, name)
    .replace(/\{full_name\}/gi, full)
    .replace(/\{username\}/gi, m.username ? `@${m.username}` : name);
}

function InboxPage() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [replyTo, setReplyTo] = useState<InboxMessage | null>(null);
  const [manageOpen, setManageOpen] = useState(false);

  const { data: messages, isLoading } = useQuery({
    queryKey: ["inbox-messages"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inbox_messages")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as InboxMessage[];
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
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setManageOpen(true)}>
              <Sparkles className="h-4 w-4 mr-2" /> Templates
            </Button>
            <Button variant="outline" onClick={markAllRead} disabled={!unreadCount}>
              <CheckCheck className="h-4 w-4 mr-2" /> Mark all read
            </Button>
          </div>
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
                    <div className="mt-3 flex gap-2 flex-wrap">
                      <Button size="sm" onClick={() => setReplyTo(m)}>
                        <Reply className="h-4 w-4 mr-1" /> Reply
                      </Button>
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

      <ReplyDialog
        message={replyTo}
        onClose={() => setReplyTo(null)}
        onSent={() => {
          setReplyTo(null);
          qc.invalidateQueries({ queryKey: ["inbox-messages"] });
        }}
        onManageTemplates={() => {
          setReplyTo(null);
          setManageOpen(true);
        }}
      />

      <ManageTemplatesDialog open={manageOpen} onOpenChange={setManageOpen} />
    </div>
  );
}

function useTemplates() {
  return useQuery({
    queryKey: ["reply-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reply_templates")
        .select("*")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Template[];
    },
  });
}

function ReplyDialog({
  message,
  onClose,
  onSent,
  onManageTemplates,
}: {
  message: InboxMessage | null;
  onClose: () => void;
  onSent: () => void;
  onManageTemplates: () => void;
}) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const { data: templates } = useTemplates();
  const sendFn = useServerFn(replyToInboxMessage);

  // Reset text when target changes
  useMemo(() => {
    setText("");
  }, [message?.id]);

  if (!message) return null;
  const display = [message.first_name, message.last_name].filter(Boolean).join(" ") || message.username || `#${message.telegram_id}`;

  async function send() {
    if (!message) return;
    if (!text.trim()) return toast.error("Write a reply first");
    setSending(true);
    try {
      await sendFn({ data: { messageId: message.id, text } });
      toast.success(`Reply sent to ${display}`);
      onSent();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to send reply");
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog open={!!message} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Reply to {display}</DialogTitle>
          <DialogDescription>Send a direct Telegram message back to this user.</DialogDescription>
        </DialogHeader>

        <Card className="p-3 bg-muted/30 border-dashed">
          <p className="text-xs text-muted-foreground mb-1">Their message</p>
          <p className="text-sm whitespace-pre-wrap break-words">{message.text}</p>
        </Card>

        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Templates</p>
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={onManageTemplates}>
              <Pencil className="h-3 w-3 mr-1" /> Manage
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {(templates ?? []).length === 0 && (
              <p className="text-xs text-muted-foreground">No templates yet — click Manage to create one.</p>
            )}
            {(templates ?? []).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setText(applyVars(t.content, message))}
                className="px-3 py-1.5 rounded-full text-xs border border-border bg-card hover:bg-accent hover:border-primary/40 transition-colors"
              >
                {t.title}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Your reply</p>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Write your reply — HTML supported (<b>, <i>, <a>)…"
            rows={6}
            className="resize-none"
          />
          <p className="text-[11px] text-muted-foreground mt-1">
            Variables: <code>{`{name}`}</code>, <code>{`{full_name}`}</code>, <code>{`{username}`}</code>
          </p>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={sending}>
            Cancel
          </Button>
          <Button onClick={send} disabled={sending || !text.trim()}>
            <Send className="h-4 w-4 mr-2" />
            {sending ? "Sending…" : "Send reply"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ManageTemplatesDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient();
  const { data: templates, isLoading } = useTemplates();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);

  function startNew() {
    setEditingId(null);
    setTitle("");
    setContent("");
  }

  function startEdit(t: Template) {
    setEditingId(t.id);
    setTitle(t.title);
    setContent(t.content);
  }

  async function save() {
    if (!title.trim() || !content.trim()) return toast.error("Title and content are required");
    setSaving(true);
    try {
      if (editingId) {
        const { error } = await supabase
          .from("reply_templates")
          .update({ title: title.trim(), content })
          .eq("id", editingId);
        if (error) throw error;
        toast.success("Template updated");
      } else {
        const { error } = await supabase.from("reply_templates").insert({ title: title.trim(), content });
        if (error) throw error;
        toast.success("Template created");
      }
      startNew();
      qc.invalidateQueries({ queryKey: ["reply-templates"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this template?")) return;
    const { error } = await supabase.from("reply_templates").delete().eq("id", id);
    if (error) return toast.error(error.message);
    if (editingId === id) startNew();
    toast.success("Template deleted");
    qc.invalidateQueries({ queryKey: ["reply-templates"] });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Reply templates</DialogTitle>
          <DialogDescription>
            Reusable snippets for common support replies. Use <code>{`{name}`}</code> to insert the user's first name.
          </DialogDescription>
        </DialogHeader>

        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Saved</p>
              <Button size="sm" variant="ghost" className="h-7" onClick={startNew}>
                <Plus className="h-3 w-3 mr-1" /> New
              </Button>
            </div>
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : (templates ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No templates yet.</p>
            ) : (
              (templates ?? []).map((t) => (
                <div
                  key={t.id}
                  className={`group flex items-start gap-2 p-2 rounded-md border cursor-pointer transition-colors ${
                    editingId === t.id ? "border-primary/50 bg-primary/[0.04]" : "border-border hover:bg-accent"
                  }`}
                  onClick={() => startEdit(t)}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{t.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{t.content}</p>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      remove(t.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition"
                    aria-label="Delete template"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))
            )}
          </div>

          <div className="space-y-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {editingId ? "Edit template" : "New template"}
            </p>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Title (e.g. 👋 Welcome)"
            />
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Hi {name}, thanks for reaching out…"
              rows={8}
              className="resize-none"
            />
            <div className="flex gap-2">
              <Button onClick={save} disabled={saving} className="flex-1">
                {saving ? "Saving…" : editingId ? "Update template" : "Create template"}
              </Button>
              {editingId && (
                <Button variant="outline" onClick={startNew}>
                  Cancel
                </Button>
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
