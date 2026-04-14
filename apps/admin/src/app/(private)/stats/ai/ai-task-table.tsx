import { buildAiTaskReportHref } from "@/data/stats/ai/ai-task-hrefs";
import { type AiTaskSummary } from "@/data/stats/ai/get-ai-task-summaries";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@zoonk/ui/components/table";
import Link from "next/link";
import { formatAiCost } from "./format-ai-cost";

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
          <TableHead className="text-right">Total Market Cost</TableHead>
          <TableHead className="text-right">Avg Market Cost / Request</TableHead>
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
  const href = buildAiTaskReportHref({ endDate, startDate, taskName: task.taskName });

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
      <TableCell className="text-right tabular-nums">
        {formatAiCost(task.totalMarketCost)}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {formatAiCost(task.averageMarketCostPerRequest)}
      </TableCell>
    </TableRow>
  );
}
