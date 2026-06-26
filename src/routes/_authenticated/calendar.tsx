import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { format, isSameDay } from "date-fns";
import { BellRing, Send, Megaphone } from "lucide-react";

export const Route = createFileRoute("/_authenticated/calendar")({
  head: () => ({ meta: [{ title: "Calendar — Pulse" }] }),
  component: CalendarPage,
});

function CalendarPage() {
  const [selected, setSelected] = useState<Date | undefined>(new Date());

  const { data } = useQuery({
    queryKey: ["calendar-events"],
    queryFn: async () => {
      const [b, a, r] = await Promise.all([
        supabase.from("broadcasts").select("id,title,message,scheduled_at,status").not("scheduled_at", "is", null),
        supabase.from("announcements").select("id,title,message,publish_at,status").not("publish_at", "is", null),
        supabase.from("reminders").select("id,title,message,next_run,status").not("next_run", "is", null),
      ]);
      const items = [
        ...(b.data ?? []).map((x) => ({ id: x.id, type: "broadcast" as const, title: x.title || "Broadcast", at: x.scheduled_at!, status: x.status })),
        ...(a.data ?? []).map((x) => ({ id: x.id, type: "announcement" as const, title: x.title, at: x.publish_at!, status: x.status })),
        ...(r.data ?? []).map((x) => ({ id: x.id, type: "reminder" as const, title: x.title, at: x.next_run!, status: x.status })),
      ];
      return items.sort((x, y) => +new Date(x.at) - +new Date(y.at));
    },
  });

  const eventDays = (data ?? []).map((e) => new Date(e.at));
  const forDay = (data ?? []).filter((e) => selected && isSameDay(new Date(e.at), selected));

  const Icon = ({ t }: { t: string }) => t === "broadcast" ? <Send className="h-3.5 w-3.5" /> : t === "announcement" ? <Megaphone className="h-3.5 w-3.5" /> : <BellRing className="h-3.5 w-3.5" />;

  return (
    <div>
      <PageHeader title="Calendar" description="Upcoming broadcasts, reminders, and announcements." />
      <div className="grid lg:grid-cols-[auto_1fr] gap-6">
        <Card className="surface-card p-3 w-fit">
          <Calendar
            mode="single"
            selected={selected}
            onSelect={setSelected}
            modifiers={{ scheduled: eventDays }}
            modifiersClassNames={{ scheduled: "bg-primary/20 text-primary-foreground rounded-md" }}
          />
        </Card>
        <Card className="surface-card">
          <CardContent className="p-5">
            <p className="text-sm font-medium mb-3">{selected ? format(selected, "EEEE, MMMM d, yyyy") : "Select a date"}</p>
            <div className="space-y-2">
              {forDay.length === 0 && <p className="text-sm text-muted-foreground">Nothing scheduled.</p>}
              {forDay.map((e) => (
                <div key={`${e.type}-${e.id}`} className="flex items-center gap-3 p-3 rounded-md bg-muted/40">
                  <div className="h-7 w-7 rounded-md bg-primary/15 text-primary flex items-center justify-center"><Icon t={e.type} /></div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{e.title}</p>
                    <p className="text-xs text-muted-foreground">{format(new Date(e.at), "HH:mm")} · {e.type}</p>
                  </div>
                  <Badge variant="outline">{e.status}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
