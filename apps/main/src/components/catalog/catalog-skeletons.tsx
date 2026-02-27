import { MediaCardSkeleton } from "@zoonk/ui/components/media-card";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { CatalogContainer, CatalogToolbar } from "./catalog-list";

function CatalogListItemSkeleton() {
  return (
    <li className="-mx-3 flex items-start gap-3 px-3 py-3.5">
      <Skeleton className="h-4 w-6 shrink-0" />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3.5 w-full" />
      </div>
    </li>
  );
}

function CatalogListItemIndicatorSkeleton() {
  return (
    <li className="-mx-3 flex items-start gap-3 px-3 py-3.5">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-3.5 w-full" />
      </div>
      <Skeleton className="size-3.5 shrink-0 self-center rounded-full" />
    </li>
  );
}

export function CatalogListSkeleton({
  count,
  search = false,
  variant = "position",
}: {
  count: number;
  search?: boolean;
  variant?: "indicator" | "position";
}) {
  const ItemSkeleton =
    variant === "indicator" ? CatalogListItemIndicatorSkeleton : CatalogListItemSkeleton;

  return (
    <div className="flex flex-col gap-4">
      {search && <Skeleton className="h-9 w-full rounded-md" />}
      <ul className="flex flex-col">
        {Array.from({ length: count }).map((_, i) => (
          // oxlint-disable-next-line eslint/no-array-index-key -- static skeleton
          <ItemSkeleton key={i} />
        ))}
      </ul>
    </div>
  );
}

const DEFAULT_LIST_COUNT = 5;

export function CatalogPageSkeleton({
  listCount = DEFAULT_LIST_COUNT,
  listVariant,
  showSearch = true,
}: {
  listCount?: number;
  listVariant?: "indicator";
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
        <CatalogListSkeleton count={listCount} search={showSearch} variant={listVariant} />
      </CatalogContainer>
    </>
  );
}
