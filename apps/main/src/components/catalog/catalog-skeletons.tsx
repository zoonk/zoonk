import { type GridGroupVariant, GridSkeleton, GridToolbar } from "@zoonk/ui/components/grid";
import { MediaCardSkeleton } from "@zoonk/ui/components/media-card";
import { Skeleton } from "@zoonk/ui/components/skeleton";

/**
 * Catalog grid loading mirrors the final tile layout so route transitions do
 * not jump from old list rows into the new compact grid.
 */
export function CatalogGridSkeleton({
  count,
  groupVariant,
  search = false,
}: {
  count: number;
  groupVariant?: GridGroupVariant;
  search?: boolean;
}) {
  return (
    <div className="flex flex-col gap-4">
      {search && (
        <div className="relative">
          <Skeleton className="h-10 w-full rounded-md" />
        </div>
      )}
      <GridSkeleton count={count} variant={groupVariant} />
    </div>
  );
}

/**
 * Keeps the catalog identity and actions stable while a course or chapter
 * sidebar streams independently from its item grid.
 */
export function CatalogSidebarSkeleton() {
  return (
    <>
      <MediaCardSkeleton variant="sidebar" />
      <GridToolbar>
        <Skeleton className="h-10 flex-1 rounded-full" />
        <Skeleton className="size-10 rounded-full" />
      </GridToolbar>
    </>
  );
}
