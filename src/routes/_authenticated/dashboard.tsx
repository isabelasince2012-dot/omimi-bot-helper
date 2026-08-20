import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Users, Activity, Send, BellRing, AlertTriangle, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { format, subDays } from "date-fns";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — tele-bot" }] }),
  component: Dashboard,
});

function Dashboard() {
  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const [users, activeToday, sentToday, failedToday, reminders] = await Promise.all([
        supabase.from("telegram_users").select("*", { count: "exact", head: true }),
        supabase.from("telegram_users").select("*", { count: "exact", head: true }).gte("last_active", today.toISOString()),
        supabase.from("message_logs").select("*", { count: "exact", head: true }).eq("status", "sent").gte("sent_at", today.toISOString()),
        supabase.from("message_logs").select("*", { count: "exact", head: true }).eq("status", "failed").gte("sent_at", today.toISOString()),
        supabase.from("reminders").select("*", { count: "exact", head: true }).eq("status", "active"),
      ]);
      return {
        users: users.count ?? 0,
        activeToday: activeToday.count ?? 0,
        sentToday: sentToday.count ?? 0,
        failedToday: failedToday.count ?? 0,
        reminders: reminders.count ?? 0,
      };
    },
  });

  const { data: signups } = useQuery({
    queryKey: ["dashboard-signups"],
    queryFn: async () => {
      const start = subDays(new Date(), 13);
      start.setHours(0, 0, 0, 0);
      const { data } = await supabase
        .from("telegram_users")
        .select("created_at")
        .gte("created_at", start.toISOString());
      const buckets = new Map<string, number>();
      for (let i = 13; i >= 0; i--) {
        const d = subDays(new Date(), i);
        buckets.set(format(d, "MMM d"), 0);
      }
      data?.forEach((r) => {
        const key = format(new Date(r.created_at), "MMM d");
        if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + 1);
      });
      return Array.from(buckets, ([day, count]) => ({ day, count }));
    },
  });

  return (
    <div>
      <PageHeader title="Dashboard" description="Overview of your Telegram audience and broadcasts." />

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        <StatCard label="Total users" value={stats?.users ?? "—"} icon={Users} />
        <StatCard label="Active today" value={stats?.activeToday ?? "—"} icon={Activity} tone="success" />
        <StatCard label="Sent today" value={stats?.sentToday ?? "—"} icon={Send} />
        <StatCard label="Scheduled" value={stats?.reminders ?? "—"} icon={BellRing} tone="warning" />
        <StatCard label="Failed today" value={stats?.failedToday ?? "—"} icon={AlertTriangle} tone="destructive" />
      </div>

      <Card className="mt-6 surface-card">
        <CardHeader>
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            New users — last 14 days
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={{ count: { label: "Signups", color: "var(--color-chart-1)" } }} className="h-[280px] w-full">
            <ResponsiveContainer>
              <AreaChart data={signups ?? []}>
                <defs>
                  <linearGradient id="fillSignups" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-chart-1)" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="var(--color-chart-1)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
                <XAxis dataKey="day" stroke="var(--color-muted-foreground)" fontSize={11} />
                <YAxis stroke="var(--color-muted-foreground)" fontSize={11} allowDecimals={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Area type="monotone" dataKey="count" stroke="var(--color-chart-1)" fill="url(#fillSignups)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </ChartContainer>
        </CardContent>
      </Card>
    </div>
  );
}
