import { TaskSkeleton } from "@zoonk/learn/task-layout";
import { Skeleton } from "@zoonk/ui/components/skeleton";

export function PracticeSkeleton() {
  return (
    <TaskSkeleton aside menu progress title={<Skeleton className="h-4 w-32" />}>
      <Skeleton className="mb-3.5 h-5 w-full" />
      <Skeleton className="mb-3.5 h-7 w-2/3" />
      <Skeleton className="h-12 w-full rounded-xl" />
      <Skeleton className="h-12 w-full rounded-xl" />
    </TaskSkeleton>
  );
}
