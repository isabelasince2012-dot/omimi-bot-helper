import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Megaphone, Trash2 } from "lucide-react";
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

export const Route = createFileRoute("/_authenticated/announcements")({
  head: () => ({ meta: [{ title: "Announcements — tele-bot" }] }),
  component: AnnouncementsPage,
});

function AnnouncementsPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", message: "", priority: "normal", image_url: "", publish_at: "" });

  const { data: items } = useQuery({
    queryKey: ["announcements"],
    queryFn: async () => {
      const { data, error } = await supabase.from("announcements").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  async function publish(immediate: boolean) {
    if (!form.title.trim() || !form.message.trim()) return toast.error("Title and description required");
    const { error } = await supabase.from("announcements").insert({
      title: form.title,
      message: form.message,
      priority: form.priority,
      image_url: form.image_url || null,
      publish_at: form.publish_at ? new Date(form.publish_at).toISOString() : (immediate ? new Date().toISOString() : null),
      status: immediate ? "published" : "scheduled",
    });
    if (error) return toast.error(error.message);
    toast.success(immediate ? "Published" : "Scheduled");
    setOpen(false);
    setForm({ title: "", message: "", priority: "normal", image_url: "", publish_at: "" });
    qc.invalidateQueries({ queryKey: ["announcements"] });
  }

  const priorityColor = (p: string) =>
    p === "high" ? "bg-destructive/15 text-destructive border-destructive/30"
    : p === "low" ? "bg-muted text-muted-foreground"
    : "bg-primary/15 text-primary border-primary/30";

  return (
    <div>
      <PageHeader
        title="Announcements"
        description="Publish announcements to your audience."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-2" />New announcement</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New announcement</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2"><Label>Title *</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
                <div className="space-y-2"><Label>Description *</Label><Textarea rows={4} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Priority</Label>
                    <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="normal">Normal</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2"><Label>Image URL</Label><Input value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} placeholder="https://..." /></div>
                </div>
                <div className="space-y-2"><Label>Schedule for later</Label><Input type="datetime-local" value={form.publish_at} onChange={(e) => setForm({ ...form, publish_at: e.target.value })} /></div>
              </div>
              <DialogFooter className="gap-2">
                {form.publish_at ? (
                  <Button onClick={() => publish(false)}>Schedule</Button>
                ) : (
                  <Button onClick={() => publish(true)}>Publish now</Button>
                )}
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="grid gap-3">
        {(items ?? []).length === 0 && (
          <Card className="surface-card p-12 text-center">
            <Megaphone className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No announcements yet.</p>
          </Card>
        )}
        {items?.map((a) => (
          <Card key={a.id} className="surface-card">
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-medium">{a.title}</p>
                    <Badge variant="outline" className={priorityColor(a.priority)}>{a.priority}</Badge>
                    <Badge variant="outline">{a.status}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{a.message}</p>
                  <p className="text-xs text-muted-foreground mt-2">{format(new Date(a.created_at), "MMM d, yyyy HH:mm")}</p>
                </div>
                <Button variant="ghost" size="icon" onClick={async () => {
                  if (!confirm("Delete this announcement?")) return;
                  const { error } = await supabase.from("announcements").delete().eq("id", a.id);
                  if (error) return toast.error(error.message);
                  toast.success("Announcement deleted");
                  qc.invalidateQueries({ queryKey: ["announcements"] });
                }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
