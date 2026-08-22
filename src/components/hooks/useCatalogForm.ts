import { useCallback, useState } from "react";
import type { CatalogItem } from "@/types";
import type { ApiErrorBody, ApiErrorDetail } from "@/lib/api-response";

export interface CatalogFormValues {
  title: string;
  description: string;
  tagsText: string;
}

function parseTags(tagsText: string): string[] {
  return tagsText
    .split(",")
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0);
}

export function useCatalogForm(options: { mode: "create" | "edit"; itemId?: string; initial: CatalogFormValues }) {
  const [values, setValues] = useState(options.initial);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const setField = useCallback((field: keyof CatalogFormValues, value: string) => {
    setValues((prev) => ({ ...prev, [field]: value }));
    setFieldErrors((prev) => {
      if (!(field in prev)) return prev;
      const next: Record<string, string> = {};
      for (const [key, message] of Object.entries(prev)) {
        if (key !== field) next[key] = message;
      }
      return next;
    });
  }, []);

  const applyDetails = useCallback((details?: ApiErrorDetail[]) => {
    if (!details?.length) return;
    const next: Record<string, string> = {};
    for (const detail of details) {
      const field = detail.field === "tags" ? "tagsText" : detail.field;
      next[field] = detail.message;
    }
    setFieldErrors(next);
  }, []);

  const submit = useCallback(async () => {
    setPending(true);
    setFormError(null);
    setFieldErrors({});

    const body = {
      title: values.title,
      description: values.description,
      tags: parseTags(values.tagsText),
    };

    try {
      const response = await fetch(
        options.mode === "create" ? "/api/admin/catalog" : `/api/admin/catalog/${options.itemId}`,
        {
          method: options.mode === "create" ? "POST" : "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      const payload = (await response.json()) as ApiErrorBody & { data?: CatalogItem };

      if (!response.ok) {
        setFormError(payload.error || "Request failed");
        applyDetails(payload.details);
        return null;
      }

      return payload.data ?? null;
    } catch {
      setFormError("Network error");
      return null;
    } finally {
      setPending(false);
    }
  }, [applyDetails, options.itemId, options.mode, values]);

  const setStatus = useCallback(
    async (status: "approved" | "rejected") => {
      if (!options.itemId) return null;
      setPending(true);
      setFormError(null);
      try {
        const response = await fetch(`/api/admin/catalog/${options.itemId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        });
        const payload = (await response.json()) as ApiErrorBody & { data?: CatalogItem };
        if (!response.ok) {
          setFormError(payload.error || "Request failed");
          applyDetails(payload.details);
          return null;
        }
        return payload.data ?? null;
      } catch {
        setFormError("Network error");
        return null;
      } finally {
        setPending(false);
      }
    },
    [applyDetails, options.itemId],
  );

  return { values, setField, fieldErrors, formError, pending, submit, setStatus };
}
