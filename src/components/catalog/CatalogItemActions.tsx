import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { InlineError, LoadingLabel } from "@/components/InlineFeedback";
import { useAssignmentActions } from "@/components/hooks/useAssignmentActions";
import type { ListType } from "@/types";

interface Props {
  catalogItemId: string;
  listType?: ListType;
  assignmentId?: string;
}

function listLabel(listType: ListType): string {
  return listType === "library" ? "Library" : "Wishlist";
}

export default function CatalogItemActions({ catalogItemId, listType, assignmentId }: Props) {
  const { loading, error, assign, move, remove } = useAssignmentActions();

  return (
    <div className="mt-4 flex flex-wrap items-center gap-2">
      {listType ? (
        <>
          <Badge variant="secondary">{listLabel(listType)}</Badge>
          {listType === "wishlist" ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={loading}
              onClick={() => {
                void move(catalogItemId, "library");
              }}
            >
              Move to library
            </Button>
          ) : null}
          {assignmentId ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={loading}
              onClick={() => {
                void remove(assignmentId);
              }}
            >
              Remove
            </Button>
          ) : null}
        </>
      ) : (
        <>
          <Button
            type="button"
            size="sm"
            disabled={loading}
            onClick={() => {
              void assign(catalogItemId, "library");
            }}
          >
            Add to library
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={loading}
            onClick={() => {
              void assign(catalogItemId, "wishlist");
            }}
          >
            Add to wishlist
          </Button>
        </>
      )}
      {loading ? <LoadingLabel className="w-full" /> : null}
      {error ? <InlineError className="w-full">{error}</InlineError> : null}
    </div>
  );
}
