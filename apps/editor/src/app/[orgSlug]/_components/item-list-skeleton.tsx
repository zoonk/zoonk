import { Skeleton } from "@zoonk/ui/components/skeleton";

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
