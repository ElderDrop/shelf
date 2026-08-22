import { useState, useTransition } from "react";
import type { CatalogItem, CatalogStatus } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ApiErrorBody } from "@/lib/api-response";

type FilterValue = "all" | CatalogStatus;

interface Props {
  initialItems: CatalogItem[];
}

function statusBadgeVariant(status: CatalogStatus) {
  if (status === "pending") return "secondary" as const;
  if (status === "rejected") return "destructive" as const;
  return "default" as const;
}

export default function CatalogList({ initialItems }: Props) {
  const [items, setItems] = useState(initialItems);
  const [filter, setFilter] = useState<FilterValue>("all");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function refresh(nextFilter: FilterValue) {
    setError(null);
    const query = nextFilter === "all" ? "" : `?status=${nextFilter}`;
    const response = await fetch(`/api/admin/catalog${query}`);
    const payload = (await response.json()) as ApiErrorBody & { data?: CatalogItem[] };
    if (!response.ok) {
      setError(payload.error || "Failed to load catalog");
      return;
    }
    setItems(payload.data ?? []);
  }

  function onFilterChange(next: FilterValue) {
    setFilter(next);
    startTransition(() => {
      void refresh(next);
    });
  }

  async function patchStatus(id: string, status: "approved" | "rejected") {
    setError(null);
    const response = await fetch(`/api/admin/catalog/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const payload = (await response.json()) as ApiErrorBody & { data?: CatalogItem };
    if (!response.ok) {
      setError(payload.error || "Failed to update status");
      return;
    }
    await refresh(filter);
  }

  return (
    <Card className="border-zinc-800 bg-zinc-950 text-zinc-100">
      <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
        <CardTitle className="text-xl">Catalog</CardTitle>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-zinc-400">
            Status
            <select
              className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-zinc-100"
              value={filter}
              disabled={isPending}
              onChange={(event) => {
                onFilterChange(event.target.value as FilterValue);
              }}
            >
              <option value="all">All</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </label>
          <Button asChild>
            <a href="/admin/catalog/new">New item</a>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {error ? <p className="mb-4 text-sm text-red-400">{error}</p> : null}
        {items.length === 0 ? (
          <p className="text-sm text-zinc-400">No catalog items for this filter.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-zinc-800 hover:bg-transparent">
                <TableHead className="text-zinc-400">Title</TableHead>
                <TableHead className="text-zinc-400">Status</TableHead>
                <TableHead className="text-zinc-400">Tags</TableHead>
                <TableHead className="text-right text-zinc-400">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id} className="border-zinc-800">
                  <TableCell className="font-medium text-zinc-100">{item.title}</TableCell>
                  <TableCell>
                    <Badge variant={statusBadgeVariant(item.status)}>{item.status}</Badge>
                  </TableCell>
                  <TableCell className="max-w-xs truncate text-zinc-400">
                    {item.tags.length > 0 ? item.tags.join(", ") : "—"}
                  </TableCell>
                  <TableCell className="space-x-2 text-right">
                    <Button asChild variant="outline" size="sm">
                      <a href={`/admin/catalog/${item.id}`}>Edit</a>
                    </Button>
                    {item.status !== "approved" ? (
                      <Button
                        size="sm"
                        disabled={isPending}
                        onClick={() => {
                          void patchStatus(item.id, "approved");
                        }}
                      >
                        Approve
                      </Button>
                    ) : null}
                    {item.status !== "rejected" ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={isPending}
                        onClick={() => {
                          void patchStatus(item.id, "rejected");
                        }}
                      >
                        Reject
                      </Button>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
