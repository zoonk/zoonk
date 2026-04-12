import { getAiTaskHref } from "@/data/stats/ai/ai-task-stats";
import { type AiTaskSummary } from "@/data/stats/ai/get-ai-task-summaries";
import { Badge } from "@zoonk/ui/components/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@zoonk/ui/components/table";
import Link from "next/link";

/**
 * The index page only needs a compact, scan-friendly task list. A plain table is
 * the clearest way to compare request counts and gives each task a predictable
 * link target into its detail view.
 */
export function AiTaskTable({
  endDate,
  startDate,
  tasks,
}: {
  endDate: string;
  startDate: string;
  tasks: AiTaskSummary[];
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Task</TableHead>
          <TableHead className="text-right">Requests</TableHead>
          <TableHead className="text-right">Fallback Requests</TableHead>
        </TableRow>
      </TableHeader>

      <TableBody>
        {tasks.map((task) => (
          <AiTaskRow endDate={endDate} key={task.taskName} startDate={startDate} task={task} />
        ))}
      </TableBody>
    </Table>
  );
}

/**
 * Each summary row links to the task detail view while preserving the selected
 * report range. That way the detail page opens in the same context the admin
 * just inspected on the index view.
 */
function AiTaskRow({
  endDate,
  startDate,
  task,
}: {
  endDate: string;
  startDate: string;
  task: AiTaskSummary;
}) {
  const href = buildTaskHref({ endDate, startDate, taskName: task.taskName });

  return (
    <TableRow>
      <TableCell className="font-medium">
        <Link className="hover:underline" href={href}>
          {task.taskLabel}
        </Link>
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {task.requestCount.toLocaleString()}
      </TableCell>
      <TableCell className="text-right">
        <FallbackCount task={task} />
      </TableCell>
    </TableRow>
  );
}

/**
 * Older reporting data may exist from before default-model tags were added.
 * This keeps the list honest by distinguishing "no fallback requests" from
 * "no fallback metadata available for this time range".
 */
function FallbackCount({ task }: { task: AiTaskSummary }) {
  if (!task.hasFallbackTracking) {
    return <span className="text-muted-foreground">—</span>;
  }

  if (task.fallbackRequestCount > 0) {
    return <Badge variant="secondary">{task.fallbackRequestCount.toLocaleString()}</Badge>;
  }

  return <span className="tabular-nums">{task.fallbackRequestCount.toLocaleString()}</span>;
}

/**
 * The detail page reads its filters from the query string. Building the href in
 * one place keeps the index links aligned with that contract and avoids hand-
 * written query strings drifting across call sites.
 */
function buildTaskHref({
  endDate,
  startDate,
  taskName,
}: {
  endDate: string;
  startDate: string;
  taskName: string;
}): string {
  const searchParams = new URLSearchParams({ from: startDate, to: endDate });
  return `${getAiTaskHref(taskName)}?${searchParams.toString()}`;
}
