import { getAiTaskSummaries } from "@/data/stats/ai/get-ai-task-summaries";
import { buttonVariants } from "@zoonk/ui/components/button";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import Link from "next/link";
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
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="text-muted-foreground max-w-3xl text-sm">
          Request counts and fallback usage for gateway-tagged AI tasks from{" "}
          {formatAiStatsDate(startDate)} to {formatAiStatsDate(endDate)}.
        </p>

        <Link
          className={buttonVariants({ variant: "outline" })}
          href={buildEstimateHref({ endDate, startDate })}
        >
          Cost Estimates
        </Link>
      </div>

      {tasks.length > 0 ? (
        <div className="rounded-lg border">
          <AiTaskTable endDate={endDate} startDate={startDate} tasks={tasks} />
        </div>
      ) : (
        <p className="text-muted-foreground text-sm">No AI task requests were reported yet.</p>
      )}
    </div>
  );
}

/**
 * The task list is backed by runtime Gateway data, so the page keeps a light
 * placeholder while the server report resolves on navigation.
 */
export function AiTaskListSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <Skeleton className="h-4 w-96" />
        <Skeleton className="h-10 w-36 rounded-full" />
      </div>
      <Skeleton className="h-64 w-full rounded-lg" />
    </div>
  );
}

/**
 * The estimates page reads its period from the query string. Building the href
 * in one place keeps the task page link aligned with that route contract.
 */
function buildEstimateHref({ endDate, startDate }: { endDate: string; startDate: string }) {
  const searchParams = new URLSearchParams({ from: startDate, to: endDate });
  return `/stats/ai/estimates?${searchParams.toString()}`;
}
