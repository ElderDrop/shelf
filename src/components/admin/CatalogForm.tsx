import type { CatalogItem, CatalogStatus } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { InlineError } from "@/components/InlineFeedback";
import { useCatalogForm } from "@/components/hooks/useCatalogForm";

interface Props {
  mode: "create" | "edit";
  item?: CatalogItem;
}

export default function CatalogForm({ mode, item }: Props) {
  const { values, setField, fieldErrors, formError, pending, submit, setStatus } = useCatalogForm({
    mode,
    itemId: item?.id,
    initial: {
      title: item?.title ?? "",
      description: item?.description ?? "",
      tagsText: item?.tags.join(", ") ?? "",
    },
  });

  async function handleSave() {
    const saved = await submit();
    if (!saved) return;
    window.location.href = mode === "create" ? "/admin/catalog" : `/admin/catalog/${saved.id}`;
  }

  async function onStatus(status: Extract<CatalogStatus, "approved" | "rejected">) {
    const saved = await setStatus(status);
    if (!saved) return;
    window.location.reload();
  }

  return (
    <Card className="mx-auto max-w-2xl">
      <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
        <CardTitle className="text-xl">{mode === "create" ? "New catalog item" : "Edit catalog item"}</CardTitle>
        {item ? <Badge variant="secondary">{item.status}</Badge> : null}
      </CardHeader>
      <CardContent>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void handleSave();
          }}
          noValidate
        >
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={values.title}
              onChange={(event) => {
                setField("title", event.target.value);
              }}
              aria-invalid={Boolean(fieldErrors.title)}
            />
            {fieldErrors.title ? <InlineError>{fieldErrors.title}</InlineError> : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={values.description}
              onChange={(event) => {
                setField("description", event.target.value);
              }}
              rows={5}
              aria-invalid={Boolean(fieldErrors.description)}
            />
            {fieldErrors.description ? <InlineError>{fieldErrors.description}</InlineError> : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="tags">Tags (comma-separated)</Label>
            <Input
              id="tags"
              value={values.tagsText}
              onChange={(event) => {
                setField("tagsText", event.target.value);
              }}
              placeholder="manga, fantasy"
              aria-invalid={Boolean(fieldErrors.tagsText)}
            />
            {fieldErrors.tagsText ? <InlineError>{fieldErrors.tagsText}</InlineError> : null}
          </div>

          {formError ? <InlineError>{formError}</InlineError> : null}

          <div className="flex flex-wrap gap-2 pt-2">
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : mode === "create" ? "Create" : "Save"}
            </Button>
            <Button asChild type="button" variant="outline">
              <a href="/admin/catalog">Back to list</a>
            </Button>
            {mode === "edit" ? (
              <>
                <Button
                  type="button"
                  disabled={pending || item?.status === "approved"}
                  onClick={() => {
                    void onStatus("approved");
                  }}
                >
                  Approve
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={pending || item?.status === "rejected"}
                  onClick={() => {
                    void onStatus("rejected");
                  }}
                >
                  Reject
                </Button>
              </>
            ) : null}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
