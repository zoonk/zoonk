import { buildAiTaskReportHref } from "@/data/stats/ai/ai-task-hrefs";
import {
  type AiFallbackTaskSummary,
  getAiFallbackTaskSummaries,
} from "@/data/stats/ai/get-ai-fallback-task-summaries";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@zoonk/ui/components/table";
import Link from "next/link";
import { AdminMetricCard } from "../_components/admin-metric-card";
import { formatAiStatsDate } from "./format-ai-cost";

/**
 * The fallback report answers one focused question: which tasks actually missed
 * their configured default model in the selected period. It stays on-demand so
 * the admin only pays for this cross-task report when it is useful.
 */
export async function AiFallbackTaskList({
  endDate,
  startDate,
}: {
  endDate: string;
  startDate: string;
}) {
  const report = await getAiFallbackTaskSummaries({ endDate, startDate });

  return (
    <section className="flex flex-col gap-6">
      <div className="flex max-w-3xl flex-col gap-1">
        <h2 className="text-base font-semibold tracking-tight">Fallback Tasks</h2>
        <p className="text-muted-foreground text-sm">
          Exact fallback counts from {formatAiStatsDate(startDate)} to {formatAiStatsDate(endDate)}.
          This summary reuses the task totals and then checks one grouped report per active default
          model, which is much cheaper than loading every task breakdown.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2 xl:grid-cols-3">
        <AdminMetricCard
          description={
            report.activeTaskCount > 0
              ? `${report.tasks.length.toLocaleString()} of ${report.activeTaskCount.toLocaleString()} active fallback-capable tasks.`
              : "No active fallback-capable tasks in this period."
          }
          title="Tasks With Fallbacks"
          value={report.tasks.length.toLocaleString()}
        />
        <AdminMetricCard
          description="Requests that were served by a model other than the configured default."
          title="Fallback Requests"
          value={report.fallbackRequestCount.toLocaleString()}
        />
        <AdminMetricCard
          description="Share of traffic across active fallback-capable tasks."
          title="Fallback Rate"
          value={formatAiFallbackRate(report.fallbackRate)}
        />
      </div>

      {report.tasks.length > 0 ? (
        <div className="rounded-lg border">
          <AiFallbackTaskTable endDate={endDate} startDate={startDate} tasks={report.tasks} />
        </div>
      ) : (
        <p className="text-muted-foreground text-sm">
          No tasks used fallback models in the selected range.
        </p>
      )}
    </section>
  );
}

/**
 * The fallback summary is still backed by live Gateway data, so the placeholder
 * mirrors the cards and table footprint while the report resolves.
 */
export function AiFallbackTaskListSkeleton() {
  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-4 w-[36rem]" />
      </div>
      <div className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2 xl:grid-cols-3">
        <Skeleton className="h-28 w-full rounded-lg" />
        <Skeleton className="h-28 w-full rounded-lg" />
        <Skeleton className="h-28 w-full rounded-lg" />
      </div>
      <Skeleton className="h-72 w-full rounded-lg" />
    </section>
  );
}

/**
 * A plain table is still the clearest way to compare fallback-heavy tasks,
 * especially when the only action users need is drilling into the exact task
 * breakdown for the same date range.
 */
function AiFallbackTaskTable({
  endDate,
  startDate,
  tasks,
}: {
  endDate: string;
  startDate: string;
  tasks: AiFallbackTaskSummary[];
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Task</TableHead>
          <TableHead>Configured Default</TableHead>
          <TableHead className="text-right">Fallback Requests</TableHead>
          <TableHead className="text-right">Fallback Rate</TableHead>
          <TableHead className="text-right">Total Requests</TableHead>
        </TableRow>
      </TableHeader>

      <TableBody>
        {tasks.map((task) => (
          <AiFallbackTaskRow
            endDate={endDate}
            key={task.taskName}
            startDate={startDate}
            task={task}
          />
        ))}
      </TableBody>
    </Table>
  );
}

/**
 * Every row links straight to the exact task breakdown view so the admin can go
 * from cross-task triage to the full model table in one click.
 */
function AiFallbackTaskRow({
  endDate,
  startDate,
  task,
}: {
  endDate: string;
  startDate: string;
  task: AiFallbackTaskSummary;
}) {
  const href = buildAiTaskReportHref({
    endDate,
    startDate,
    taskName: task.taskName,
    view: "breakdown",
  });

  return (
    <TableRow>
      <TableCell className="font-medium">
        <Link className="hover:underline" href={href}>
          {task.taskLabel}
        </Link>
      </TableCell>
      <TableCell className="font-mono text-xs sm:text-sm">{task.defaultModel}</TableCell>
      <TableCell className="text-right tabular-nums">
        {task.fallbackRequestCount.toLocaleString()}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {formatAiFallbackRate(task.fallbackRate)}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {task.requestCount.toLocaleString()}
      </TableCell>
    </TableRow>
  );
}

/**
 * Rates are easiest to scan as percentages with one decimal place because many
 * fallback issues sit in the low single-digit range.
 */
function formatAiFallbackRate(value: number) {
  return new Intl.NumberFormat("en", {
    maximumFractionDigits: 1,
    style: "percent",
  }).format(value);
}
