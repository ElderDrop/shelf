import { useCallback, useState } from "react";
import type { ListType, UserAssignment } from "@/types";
import type { ApiErrorBody } from "@/lib/api-response";

interface UseAssignmentActionsResult {
  loading: boolean;
  error: string | null;
  clearError: () => void;
  assign: (catalogItemId: string, listType: ListType) => Promise<UserAssignment | null>;
  move: (catalogItemId: string, listType: ListType) => Promise<UserAssignment | null>;
  remove: (assignmentId: string) => Promise<boolean>;
}

async function parseAssignmentResponse(response: Response): Promise<UserAssignment> {
  const payload = (await response.json()) as ApiErrorBody & { data?: UserAssignment };
  if (!response.ok) {
    throw new Error(payload.error || "Request failed");
  }
  if (!payload.data) {
    throw new Error("Request failed");
  }
  return payload.data;
}

export function useAssignmentActions(reloadOnSuccess = true): UseAssignmentActionsResult {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const postAssign = useCallback(
    async (catalogItemId: string, listType: ListType): Promise<UserAssignment | null> => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/assignments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ catalog_item_id: catalogItemId, list_type: listType }),
        });
        const assignment = await parseAssignmentResponse(response);
        if (reloadOnSuccess) {
          window.location.reload();
        }
        return assignment;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Network error");
        return null;
      } finally {
        setLoading(false);
      }
    },
    [reloadOnSuccess],
  );

  const assign = useCallback(
    (catalogItemId: string, listType: ListType) => postAssign(catalogItemId, listType),
    [postAssign],
  );

  const move = useCallback(
    (catalogItemId: string, listType: ListType) => postAssign(catalogItemId, listType),
    [postAssign],
  );

  const remove = useCallback(
    async (assignmentId: string): Promise<boolean> => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/assignments/${assignmentId}`, { method: "DELETE" });
        if (!response.ok) {
          const payload = (await response.json()) as ApiErrorBody;
          throw new Error(payload.error || "Request failed");
        }
        if (reloadOnSuccess) {
          window.location.reload();
        }
        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Network error");
        return false;
      } finally {
        setLoading(false);
      }
    },
    [reloadOnSuccess],
  );

  return { loading, error, clearError, assign, move, remove };
}
