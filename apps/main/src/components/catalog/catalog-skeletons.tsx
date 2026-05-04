import { CatalogListSkeleton as CatalogListPatternSkeleton } from "@zoonk/ui/components/catalog-list";
import { MediaCardSkeleton } from "@zoonk/ui/components/media-card";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { CatalogContainer, CatalogToolbar } from "./catalog-list";

export function CatalogListSkeleton({
  count,
  search = false,
}: {
  count: number;
  search?: boolean;
}) {
  return (
    <div className="flex flex-col gap-4">
      {search && <Skeleton className="h-9 w-full rounded-md" />}
      <CatalogListPatternSkeleton count={count} />
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
      <CatalogContainer>
        <CatalogToolbar>
          <Skeleton className="h-9 flex-1 rounded-md" />
          <Skeleton className="size-9 rounded-md" />
        </CatalogToolbar>
        <CatalogListSkeleton count={listCount} search={showSearch} />
      </CatalogContainer>
    </>
  );
}
