import { Grid, GridSkeleton, GridToolbar } from "@zoonk/ui/components/grid";
import { MediaCardSkeleton } from "@zoonk/ui/components/media-card";
import { Skeleton } from "@zoonk/ui/components/skeleton";

/**
 * Catalog grid loading mirrors the final tile layout so route transitions do
 * not jump from old list rows into the new compact grid.
 */
export function CatalogGridSkeleton({
  count,
  search = false,
}: {
  count: number;
  search?: boolean;
}) {
  return (
    <div className="flex flex-col gap-4">
      {search && (
        <div className="relative">
          <Skeleton className="h-10 w-full rounded-md" />
        </div>
      )}
      <GridSkeleton count={count} />
    </div>
  );
}

const DEFAULT_LIST_COUNT = 5;

export function CatalogPageSkeleton({
  listCount = DEFAULT_LIST_COUNT,
  showSearch = true,
}: {
  listCount?: number;
  showSearch?: boolean;
}) {
  return (
    <>
      <MediaCardSkeleton />
      <Grid>
        <GridToolbar>
          <Skeleton className="h-10 flex-1 rounded-full" />
          <Skeleton className="size-10 rounded-full" />
        </GridToolbar>
        <CatalogGridSkeleton count={listCount} search={showSearch} />
      </Grid>
    </>
  );
}
