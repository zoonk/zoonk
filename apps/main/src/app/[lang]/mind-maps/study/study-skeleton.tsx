import { TaskSkeleton } from "@zoonk/learn/task-layout";
import { Skeleton } from "@zoonk/ui/components/skeleton";

/** No Previous: Study opens a deck on its first map, which has none. */
export function StudySkeleton() {
  return (
    <TaskSkeleton menu title={<Skeleton className="h-4 w-40" />}>
      <Skeleton className="aspect-square w-full rounded-xl" />
      <Skeleton className="h-5 w-2/3" />
      <Skeleton className="h-4 w-full" />
    </TaskSkeleton>
  );
}
