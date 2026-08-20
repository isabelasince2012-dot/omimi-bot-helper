import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { Users, Send, CheckCircle2, XCircle } from "lucide-react";
import { format, subDays } from "date-fns";

export const Route = createFileRoute("/_authenticated/analytics")({
  head: () => ({ meta: [{ title: "Analytics — tele-bot" }] }),
  component: AnalyticsPage,
});

function AnalyticsPage() {
  const { data } = useQuery({
    queryKey: ["analytics"],
    queryFn: async () => {
      const now = new Date();
      const weekAgo = subDays(now, 7).toISOString();
      const monthAgo = subDays(now, 30).toISOString();
      const dayAgo = subDays(now, 1).toISOString();

      const [total, daily, weekly, monthly, sent, failed, joinSeries] = await Promise.all([
        supabase.from("telegram_users").select("*", { count: "exact", head: true }),
        supabase.from("telegram_users").select("*", { count: "exact", head: true }).gte("created_at", dayAgo),
        supabase.from("telegram_users").select("*", { count: "exact", head: true }).gte("created_at", weekAgo),
        supabase.from("telegram_users").select("*", { count: "exact", head: true }).gte("created_at", monthAgo),
        supabase.from("message_logs").select("*", { count: "exact", head: true }).eq("status", "sent"),
        supabase.from("message_logs").select("*", { count: "exact", head: true }).eq("status", "failed"),
        supabase.from("telegram_users").select("created_at").gte("created_at", subDays(now, 29).toISOString()),
      ]);

      const buckets = new Map<string, number>();
      for (let i = 29; i >= 0; i--) buckets.set(format(subDays(now, i), "MMM d"), 0);
      joinSeries.data?.forEach((r) => {
        const k = format(new Date(r.created_at), "MMM d");
        if (buckets.has(k)) buckets.set(k, (buckets.get(k) ?? 0) + 1);
      });

      const sentCount = sent.count ?? 0;
      const failedCount = failed.count ?? 0;
      const totalMsg = sentCount + failedCount;
      const successRate = totalMsg ? Math.round((sentCount / totalMsg) * 100) : 0;

      return {
        total: total.count ?? 0,
        daily: daily.count ?? 0,
        weekly: weekly.count ?? 0,
        monthly: monthly.count ?? 0,
        sent: sentCount,
        failed: failedCount,
        successRate,
        joinChart: Array.from(buckets, ([day, count]) => ({ day, count })),
        delivery: [
          { name: "Sent", value: sentCount, fill: "var(--color-chart-2)" },
          { name: "Failed", value: failedCount, fill: "var(--color-chart-5)" },
        ],
      };
    },
  });

  return (
    <div>
      <PageHeader title="Analytics" description="Growth, engagement, and delivery metrics." />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total users" value={data?.total ?? "—"} icon={Users} />
        <StatCard label="Joins this week" value={data?.weekly ?? "—"} delta={`Today: ${data?.daily ?? 0}`} icon={Users} tone="success" />
        <StatCard label="Messages sent" value={data?.sent ?? "—"} icon={Send} />
        <StatCard label="Delivery rate" value={`${data?.successRate ?? 0}%`} icon={data?.successRate && data.successRate >= 95 ? CheckCircle2 : XCircle} tone={data && data.successRate >= 95 ? "success" : "warning"} />
      </div>

      <div className="grid lg:grid-cols-3 gap-4 mt-6">
        <Card className="surface-card lg:col-span-2">
          <CardHeader><CardTitle className="text-base font-medium">Daily joins (30 days)</CardTitle></CardHeader>
          <CardContent>
            <ChartContainer config={{ count: { label: "Joins", color: "var(--color-chart-1)" } }} className="h-[280px] w-full">
              <ResponsiveContainer>
                <BarChart data={data?.joinChart ?? []}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
                  <XAxis dataKey="day" stroke="var(--color-muted-foreground)" fontSize={10} />
                  <YAxis stroke="var(--color-muted-foreground)" fontSize={11} allowDecimals={false} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="count" fill="var(--color-chart-1)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card className="surface-card">
          <CardHeader><CardTitle className="text-base font-medium">Delivery</CardTitle></CardHeader>
          <CardContent>
            <ChartContainer config={{ value: { label: "Messages" } }} className="h-[280px] w-full">
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={data?.delivery ?? []} dataKey="value" nameKey="name" innerRadius={60} outerRadius={90} paddingAngle={4}>
                    {(data?.delivery ?? []).map((e, i) => <Cell key={i} fill={e.fill} />)}
                  </Pie>
                  <ChartTooltip content={<ChartTooltipContent />} />
                </PieChart>
              </ResponsiveContainer>
            </ChartContainer>
            <div className="flex justify-around mt-2 text-xs">
              <div><span className="inline-block h-2 w-2 rounded-full mr-1" style={{ background: "var(--color-chart-2)" }} /> Sent: {data?.sent ?? 0}</div>
              <div><span className="inline-block h-2 w-2 rounded-full mr-1" style={{ background: "var(--color-chart-5)" }} /> Failed: {data?.failed ?? 0}</div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
