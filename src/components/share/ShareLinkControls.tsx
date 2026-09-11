import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InlineError, LoadingLabel } from "@/components/InlineFeedback";

interface ShareStatus {
  active: boolean;
  created_at?: string;
  url?: string;
}

interface ShareCreateResponse {
  url: string;
  token: string;
  created_at: string;
}

async function readError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: string };
    return body.error ?? `Request failed (${response.status})`;
  } catch {
    return `Request failed (${response.status})`;
  }
}

function copyViaExecCommand(input: HTMLInputElement): boolean {
  input.focus();
  input.select();
  input.setSelectionRange(0, input.value.length);
  try {
    // Fallback when Clipboard API is blocked (embedded browsers / missing permission).
    // eslint-disable-next-line @typescript-eslint/no-deprecated -- intentional clipboard fallback
    return document.execCommand("copy");
  } catch {
    return false;
  }
}

export default function ShareLinkControls() {
  const [status, setStatus] = useState<ShareStatus | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [statusLoaded, setStatusLoaded] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const urlInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch("/api/share", { signal: controller.signal });
        if (!response.ok) {
          setError(await readError(response));
          return;
        }
        const body = (await response.json()) as { data: ShareStatus };
        setStatus(body.data);
        if (body.data.url) {
          setUrl(body.data.url);
        }
      } catch (err) {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : "Failed to load share status");
      } finally {
        if (!controller.signal.aborted) {
          setStatusLoaded(true);
        }
      }
    })();
    return () => {
      controller.abort();
    };
  }, []);

  function selectUrlField() {
    const input = urlInputRef.current;
    if (!input) return;
    input.focus();
    input.select();
    input.setSelectionRange(0, input.value.length);
  }

  async function createOrRotate() {
    setLoading(true);
    setError(null);
    setCopied(false);
    setHint(null);
    try {
      const response = await fetch("/api/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      if (!response.ok) {
        setError(await readError(response));
        return;
      }
      const body = (await response.json()) as { data: ShareCreateResponse };
      setUrl(body.data.url);
      setStatus({ active: true, created_at: body.data.created_at });
      // Select after paint so the field exists and is easy to copy.
      queueMicrotask(() => {
        const input = urlInputRef.current;
        if (!input) return;
        input.focus();
        input.select();
      });
    } catch {
      setError("Failed to create share link");
    } finally {
      setLoading(false);
    }
  }

  async function revoke() {
    setLoading(true);
    setError(null);
    setCopied(false);
    setHint(null);
    try {
      const response = await fetch("/api/share", { method: "DELETE" });
      if (!response.ok) {
        setError(await readError(response));
        return;
      }
      setUrl(null);
      setStatus({ active: false });
    } catch {
      setError("Failed to revoke share link");
    } finally {
      setLoading(false);
    }
  }

  async function copy() {
    if (!url) return;
    setError(null);
    setHint(null);

    const input = urlInputRef.current;
    if (input) {
      selectUrlField();
    }

    try {
      if ("clipboard" in navigator && typeof navigator.clipboard.writeText === "function") {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        return;
      }
    } catch {
      // Fall through to execCommand / select hint.
    }

    if (input && copyViaExecCommand(input)) {
      setCopied(true);
      return;
    }

    selectUrlField();
    setCopied(false);
    setHint("URL selected — press Ctrl+C (⌘C on Mac) to copy");
  }

  const active = status?.active === true;
  const createdAt = status?.created_at;
  const primaryLabel = active ? "Regenerate link" : "Generate link";

  return (
    <section className="shelf-panel mt-6">
      <h2 className="text-foreground text-sm font-medium">Share library & wishlist</h2>
      <p className="text-muted-foreground mt-1 text-sm">
        Anyone with the link can view both lists read-only. Revoke anytime to invalidate it.
      </p>

      {!statusLoaded && !error ? <LoadingLabel className="mt-3">Loading…</LoadingLabel> : null}

      {active ? (
        <p className="text-foreground/80 mt-3 text-sm">
          Share link is active
          {createdAt ? (
            <>
              {" "}
              since <time dateTime={createdAt}>{new Date(createdAt).toLocaleString()}</time>
            </>
          ) : null}
          .
        </p>
      ) : null}

      {statusLoaded && status && !active ? (
        <p className="text-muted-foreground mt-3 text-sm">No active share link.</p>
      ) : null}

      {url ? (
        <div className="mt-3 space-y-2">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Input
              ref={urlInputRef}
              readOnly
              value={url}
              onFocus={selectUrlField}
              onClick={selectUrlField}
              className="min-w-0 flex-1 cursor-text font-mono text-xs select-text"
              aria-label="Share URL"
            />
            <Button type="button" variant="outline" size="sm" disabled={loading} onClick={() => void copy()}>
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
          <p className="text-muted-foreground text-xs">
            Click the URL to select it, then copy. Or open{" "}
            <a href={url} className="text-primary hover:text-foreground underline" target="_blank" rel="noreferrer">
              the share page
            </a>
            .
          </p>
        </div>
      ) : null}

      {active && !url ? (
        <p className="text-muted-foreground mt-2 text-xs">Regenerate to reveal a new URL you can copy.</p>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" disabled={loading || !statusLoaded} onClick={() => void createOrRotate()}>
          {primaryLabel}
        </Button>
        {active ? (
          <Button type="button" variant="ghost" size="sm" disabled={loading} onClick={() => void revoke()}>
            Revoke
          </Button>
        ) : null}
      </div>

      {hint ? <p className="text-foreground/80 mt-3 text-sm">{hint}</p> : null}
      {error ? <InlineError className="mt-3">{error}</InlineError> : null}
    </section>
  );
}
