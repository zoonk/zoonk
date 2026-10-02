import { GridSkeleton } from "@zoonk/ui/components/grid";

/**
 * Catalog grid loading mirrors the final tile layout so route transitions do
 * not jump from old list rows into the new compact grid.
 */
export function CatalogGridSkeleton({ count }: { count: number }) {
  return (
    <div className="flex flex-col gap-4">
      <GridSkeleton count={count} />
    </div>
  );
}
