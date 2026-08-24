import { Button } from "@/components/ui/button";
import { useAssignmentActions } from "@/components/hooks/useAssignmentActions";
import type { ListType } from "@/types";

interface Props {
  assignmentId: string;
  catalogItemId: string;
  listType: ListType;
  unavailable?: boolean;
}

function listLabel(listType: ListType): string {
  return listType === "library" ? "Library" : "Wishlist";
}

export default function CollectionItemActions({ assignmentId, catalogItemId, listType, unavailable = false }: Props) {
  const { loading, error, move, remove } = useAssignmentActions();

  const oppositeList: ListType = listType === "library" ? "wishlist" : "library";

  return (
    <div className="mt-4 flex flex-wrap items-center gap-2">
      {!unavailable ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={loading}
          onClick={() => {
            void move(catalogItemId, oppositeList);
          }}
        >
          Move to {listLabel(oppositeList).toLowerCase()}
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
      {error ? <p className="w-full text-sm text-red-400">{error}</p> : null}
    </div>
  );
}
