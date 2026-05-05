import { List, ListSkeleton as ListPatternSkeleton, ListToolbar } from "@zoonk/ui/components/list";
import { MediaCardSkeleton } from "@zoonk/ui/components/media-card";
import { Skeleton } from "@zoonk/ui/components/skeleton";

export function CatalogListSkeleton({
  count,
  search = false,
}: {
  count: number;
  search?: boolean;
}) {
  return (
    <div className="flex flex-col gap-4">
      {search && (
        <div className="px-4">
          <Skeleton className="h-9 w-full rounded-md" />
        </div>
      )}
      <ListPatternSkeleton count={count} />
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
      <List>
        <ListToolbar>
          <Skeleton className="h-9 flex-1 rounded-md" />
          <Skeleton className="size-9 rounded-md" />
        </ListToolbar>
        <CatalogListSkeleton count={listCount} search={showSearch} />
      </List>
    </>
  );
}
