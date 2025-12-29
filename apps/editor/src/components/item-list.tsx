import { Skeleton } from "@zoonk/ui/components/skeleton";
import type { Route } from "next";
import Link from "next/link";

export function ItemListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <ul className="divide-y divide-border">
      {Array.from({ length: count }).map((_, i) => (
        <li className="flex items-start gap-4 px-4 py-3" key={i}>
          <Skeleton className="h-5 w-6" />

          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-full" />
          </div>
        </li>
      ))}
    </ul>
  );
}

type ItemListItem = {
  slug: string;
  title: string;
  description: string;
  position: number;
};

type ItemListProps<T extends string> = {
  items: ItemListItem[];
  getHref: (item: ItemListItem) => Route<T>;
};

export function ItemList<T extends string>({
  items,
  getHref,
}: ItemListProps<T>) {
  if (items.length === 0) {
    return null;
  }

  return (
    <ul className="divide-y divide-border">
      {items.map((item) => (
        <li key={item.slug}>
          <Link
            className="flex items-start gap-4 px-4 py-3 transition-colors hover:bg-muted/50"
            href={getHref(item)}
          >
            <span className="mt-0.5 font-mono text-muted-foreground text-sm tabular-nums">
              {String(item.position).padStart(2, "0")}
            </span>

            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{item.title}</p>

              {item.description && (
                <p className="mt-0.5 line-clamp-2 text-muted-foreground text-sm">
                  {item.description}
                </p>
              )}
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
