import { Skeleton } from "@zoonk/ui/components/skeleton";

const SKELETON_COUNT = 8;

export function CourseListSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      {Array.from({ length: SKELETON_COUNT }).map((_, i) => (
        // oxlint-disable-next-line eslint/no-array-index-key -- static skeleton
        <div className="flex items-center gap-4 py-2" key={i}>
          <Skeleton className="size-16 shrink-0 rounded-lg" />
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3.5 w-full" />
          </div>
        </div>
      ))}
    </div>
  );
}
