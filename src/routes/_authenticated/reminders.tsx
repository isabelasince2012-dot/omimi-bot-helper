import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, BellRing, Pause, Play, Trash2 } from "lucide-react";
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

export const Route = createFileRoute("/_authenticated/reminders")({
  head: () => ({ meta: [{ title: "Reminders — tele-bot" }] }),
  component: RemindersPage,
});

function RemindersPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", message: "", date: "", time: "", timezone: "UTC", repeat_type: "once" });

  const { data: items } = useQuery({
    queryKey: ["reminders"],
    queryFn: async () => {
      const { data, error } = await supabase.from("reminders").select("*").order("schedule", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  async function create() {
    if (!form.title || !form.message || !form.date || !form.time) return toast.error("All fields required");
    const schedule = new Date(`${form.date}T${form.time}`).toISOString();
    const { error } = await supabase.from("reminders").insert({
      title: form.title,
      message: form.message,
      schedule,
      next_run: schedule,
      timezone: form.timezone,
      repeat_type: form.repeat_type,
      status: "active",
    });
    if (error) return toast.error(error.message);
    toast.success("Reminder created");
    setOpen(false);
    setForm({ title: "", message: "", date: "", time: "", timezone: "UTC", repeat_type: "once" });
    qc.invalidateQueries({ queryKey: ["reminders"] });
  }

  async function toggle(id: string, status: string) {
    const next = status === "active" ? "paused" : "active";
    await supabase.from("reminders").update({ status: next }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["reminders"] });
  }

  async function remove(id: string) {
    await supabase.from("reminders").delete().eq("id", id);
    toast.success("Reminder deleted");
    qc.invalidateQueries({ queryKey: ["reminders"] });
  }

  return (
    <div>
      <PageHeader
        title="Reminders"
        description="Schedule one-off or recurring reminders for your audience."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-2" />New reminder</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New reminder</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2"><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
                <div className="space-y-2"><Label>Message</Label><Textarea rows={3} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2"><Label>Date</Label><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
                  <div className="space-y-2"><Label>Time</Label><Input type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Timezone</Label>
                    <Select value={form.timezone} onValueChange={(v) => setForm({ ...form, timezone: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="UTC">UTC</SelectItem>
                        <SelectItem value="America/New_York">America/New_York</SelectItem>
                        <SelectItem value="America/Los_Angeles">America/Los_Angeles</SelectItem>
                        <SelectItem value="Europe/London">Europe/London</SelectItem>
                        <SelectItem value="Europe/Berlin">Europe/Berlin</SelectItem>
                        <SelectItem value="Asia/Tokyo">Asia/Tokyo</SelectItem>
                        <SelectItem value="Asia/Dubai">Asia/Dubai</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Repeat</Label>
                    <Select value={form.repeat_type} onValueChange={(v) => setForm({ ...form, repeat_type: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="once">Once</SelectItem>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              <DialogFooter><Button onClick={create}>Create reminder</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="grid gap-3">
        {(items ?? []).length === 0 && (
          <Card className="surface-card p-12 text-center">
            <BellRing className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No reminders scheduled.</p>
          </Card>
        )}
        {items?.map((r) => (
          <Card key={r.id} className="surface-card">
            <CardContent className="p-5 flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-medium truncate">{r.title}</p>
                  <Badge variant="outline" className={r.status === "active" ? "bg-success/15 text-success border-success/30" : "bg-muted"}>{r.status}</Badge>
                  <Badge variant="outline">{r.repeat_type}</Badge>
                </div>
                <p className="text-sm text-muted-foreground line-clamp-1">{r.message}</p>
                <p className="text-xs text-muted-foreground mt-2">Next: {r.next_run ? format(new Date(r.next_run), "MMM d, yyyy HH:mm") : "—"} ({r.timezone})</p>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" onClick={() => toggle(r.id, r.status)}>
                  {r.status === "active" ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                </Button>
                <Button variant="ghost" size="icon" onClick={() => remove(r.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
