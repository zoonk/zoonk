import { resolveAiTaskDateRange } from "@/data/stats/ai/ai-task-stats";
import { getAiTaskSummaries } from "@/data/stats/ai/get-ai-task-summaries";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { AiTaskTable } from "./ai-task-table";

/**
 * This server component owns the fixed last-30-days task index. Keeping the
 * date-range resolution and gateway query here lets the page component stay
 * focused on layout and suspense only.
 */
export async function AiTaskList() {
  const { endInput, startInput } = resolveAiTaskDateRange({});
  const tasks = await getAiTaskSummaries({ endDate: endInput, startDate: startInput });

  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted-foreground text-sm">
        Request counts and fallback usage for gateway-tagged AI text tasks in the last 30 days.
      </p>

      {tasks.length > 0 ? (
        <div className="rounded-lg border">
          <AiTaskTable tasks={tasks} />
        </div>
      ) : (
        <p className="text-muted-foreground text-sm">No AI task requests were reported yet.</p>
      )}
    </div>
  );
}

/**
 * The task list is gateway-backed runtime data, so the page needs a lightweight
 * placeholder while the report request resolves on navigation.
 */
export function AiTaskListSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-4 w-72" />
      <Skeleton className="h-64 w-full rounded-lg" />
    </div>
  );
}
