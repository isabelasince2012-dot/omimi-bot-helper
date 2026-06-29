import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Download, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";

export const Route = createFileRoute("/_authenticated/users")({
  head: () => ({ meta: [{ title: "Users — Pulse" }] }),
  component: UsersPage,
});

function UsersPage() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("all");

  const { data: users, isLoading } = useQuery({
    queryKey: ["telegram-users"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("telegram_users")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const filtered = useMemo(() => {
    return (users ?? []).filter((u) => {
      if (status !== "all" && u.status !== status) return false;
      if (!q) return true;
      const s = q.toLowerCase();
      return (
        u.username?.toLowerCase().includes(s) ||
        u.first_name?.toLowerCase().includes(s) ||
        u.last_name?.toLowerCase().includes(s) ||
        String(u.telegram_id).includes(s)
      );
    });
  }, [users, q, status]);

  function exportCSV() {
    const headers = ["telegram_id", "username", "first_name", "last_name", "phone", "language", "status", "created_at", "last_active"];
    const rows = filtered.map((u) => headers.map((h) => JSON.stringify((u as any)[h] ?? "")).join(","));
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `telegram-users-${Date.now()}.csv`;
    a.click();
  }

  return (
    <div>
      <PageHeader
        title="Users"
        description={`${filtered.length} of ${users?.length ?? 0} Telegram users`}
        actions={
          <Button variant="outline" size="sm" onClick={exportCSV}>
            <Download className="h-4 w-4 mr-2" />Export CSV
          </Button>
        }
      />

      <Card className="surface-card p-4 mb-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search by name, username, or ID..." className="pl-9" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-full sm:w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
            <SelectItem value="blocked">Blocked</SelectItem>
          </SelectContent>
        </Select>
      </Card>

      <Card className="surface-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Telegram ID</TableHead>
              <TableHead>Username</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead>Last active</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Loading...</TableCell></TableRow>
            )}
            {!isLoading && filtered.length === 0 && (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-12">
                No users yet. Users will appear when they /start your Telegram bot.
              </TableCell></TableRow>
            )}
            {filtered.map((u) => (
              <TableRow key={u.id}>
                <TableCell className="font-mono text-xs">{u.telegram_id}</TableCell>
                <TableCell>{u.username ? `@${u.username}` : "—"}</TableCell>
                <TableCell>{[u.first_name, u.last_name].filter(Boolean).join(" ") || "—"}</TableCell>
                <TableCell className="text-muted-foreground">{u.phone || "—"}</TableCell>
                <TableCell className="text-muted-foreground">{format(new Date(u.created_at), "MMM d, yyyy")}</TableCell>
                <TableCell className="text-muted-foreground">{u.last_active ? format(new Date(u.last_active), "MMM d, HH:mm") : "—"}</TableCell>
                <TableCell>
                  <Badge variant={u.status === "active" ? "default" : "secondary"} className={u.status === "active" ? "bg-success/15 text-success border-success/30" : ""}>
                    {u.status}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
