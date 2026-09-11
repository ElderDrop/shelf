import { Button } from "@/components/ui/button";
import { InlineError, LoadingLabel } from "@/components/InlineFeedback";
import { useAssignmentActions } from "@/components/hooks/useAssignmentActions";
import type { ListType } from "@/types";

interface Props {
  assignmentId: string;
  catalogItemId: string;
  listType: ListType;
  unavailable?: boolean;
}

export default function CollectionItemActions({ assignmentId, catalogItemId, listType, unavailable = false }: Props) {
  const { loading, error, move, remove } = useAssignmentActions();

  return (
    <div className="mt-4 flex flex-wrap items-center gap-2">
      {!unavailable && listType === "wishlist" ? (
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
      {loading ? <LoadingLabel className="w-full" /> : null}
      {error ? <InlineError className="w-full">{error}</InlineError> : null}
    </div>
  );
}
