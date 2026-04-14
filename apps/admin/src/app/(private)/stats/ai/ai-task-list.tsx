import { getAiTaskSummaries } from "@/data/stats/ai/get-ai-task-summaries";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { AiTaskTable } from "./ai-task-table";
import { formatAiStatsDate } from "./format-ai-cost";

/**
 * The task index should stay focused on raw Gateway activity. This server
 * component loads the selected-period task summaries and links out to the
 * dedicated estimates page for workflow-level cost modeling.
 */
export async function AiTaskList({ endDate, startDate }: { endDate: string; startDate: string }) {
  const tasks = await getAiTaskSummaries({ endDate, startDate });

  return (
    <section className="flex flex-col gap-6">
      <div className="flex max-w-3xl flex-col gap-1">
        <h2 className="text-base font-semibold tracking-tight">Live Summary</h2>
        <p className="text-muted-foreground text-sm">
          One on-demand snapshot of gateway-tagged task traffic from {formatAiStatsDate(startDate)}{" "}
          to {formatAiStatsDate(endDate)}. Open a task for model-level breakdowns only when you need
          them.
        </p>
      </div>

      {tasks.length > 0 ? (
        <>
          <p className="text-muted-foreground text-sm">
            {tasks.length.toLocaleString()} active task{tasks.length === 1 ? "" : "s"} reported in
            this range.
          </p>

          <div className="rounded-lg border">
            <AiTaskTable endDate={endDate} startDate={startDate} tasks={tasks} />
          </div>
        </>
      ) : (
        <p className="text-muted-foreground text-sm">
          No AI task requests were reported from {formatAiStatsDate(startDate)} to{" "}
          {formatAiStatsDate(endDate)}.
        </p>
      )}
    </section>
  );
}

/**
 * The task list is backed by runtime Gateway data, so the page keeps a light
 * placeholder while the server report resolves on navigation.
 */
export function AiTaskListSkeleton() {
  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-4 w-96" />
      </div>
      <Skeleton className="h-4 w-40" />
      <Skeleton className="h-64 w-full rounded-lg" />
    </section>
  );
}
