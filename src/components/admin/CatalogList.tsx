import { useState, useTransition } from "react";
import type { CatalogItem, CatalogStatus } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { InlineError, LoadingLabel } from "@/components/InlineFeedback";
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
  const [statusPending, setStatusPending] = useState(false);
  const [isPending, startTransition] = useTransition();
  const actionsDisabled = isPending || statusPending;

  async function refresh(nextFilter: FilterValue) {
    setError(null);
    const query = nextFilter === "all" ? "" : `?status=${nextFilter}`;
    try {
      const response = await fetch(`/api/admin/catalog${query}`);
      const payload = (await response.json()) as ApiErrorBody & { data?: CatalogItem[] };
      if (!response.ok) {
        setError(payload.error || "Failed to load catalog");
        return;
      }
      setItems(payload.data ?? []);
    } catch {
      setError("Network error");
    }
  }

  function onFilterChange(next: FilterValue) {
    setFilter(next);
    startTransition(() => {
      void refresh(next);
    });
  }

  async function patchStatus(id: string, status: "approved" | "rejected") {
    if (statusPending) return;
    setStatusPending(true);
    setError(null);
    try {
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
    } catch {
      setError("Network error");
    } finally {
      setStatusPending(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
        <CardTitle className="text-xl">Catalog</CardTitle>
        <div className="flex items-center gap-3">
          <div className="text-muted-foreground flex items-center gap-2 text-sm">
            <span id="catalog-status-filter-label">Status</span>
            <Select
              value={filter}
              disabled={actionsDisabled}
              onValueChange={(value) => {
                onFilterChange(value as FilterValue);
              }}
            >
              <SelectTrigger aria-labelledby="catalog-status-filter-label" className="w-[140px]" size="sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button asChild>
            <a href="/admin/catalog/new">New item</a>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {error ? <InlineError className="mb-4">{error}</InlineError> : null}
        {actionsDisabled ? <LoadingLabel className="mb-4">Updating…</LoadingLabel> : null}
        {items.length === 0 ? (
          <p className="text-muted-foreground text-sm">No catalog items for this filter.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Title</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Tags</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.title}</TableCell>
                  <TableCell>
                    <Badge variant={statusBadgeVariant(item.status)}>{item.status}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground max-w-xs truncate">
                    {item.tags.length > 0 ? item.tags.join(", ") : "—"}
                  </TableCell>
                  <TableCell className="space-x-2 text-right">
                    <Button asChild variant="outline" size="sm">
                      <a href={`/admin/catalog/${item.id}`}>Edit</a>
                    </Button>
                    {item.status !== "approved" ? (
                      <Button
                        size="sm"
                        disabled={actionsDisabled}
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
                        disabled={actionsDisabled}
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
