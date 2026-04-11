import { getAiTaskHref } from "@/data/stats/ai/ai-task-stats";
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

/**
 * The index page only needs a compact, scan-friendly task list. A plain table is
 * the clearest way to compare request counts and gives each task a predictable
 * link target into its detail view.
 */
export function AiTaskTable({ tasks }: { tasks: AiTaskSummary[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Task</TableHead>
          <TableHead className="text-right">Requests</TableHead>
        </TableRow>
      </TableHeader>

      <TableBody>
        {tasks.map((task) => (
          <AiTaskRow key={task.taskName} task={task} />
        ))}
      </TableBody>
    </Table>
  );
}

/**
 * Each summary row links to the task detail view while preserving the 30-day
 * window shown on the index page. That way the detail view opens in the same
 * context the admin just inspected.
 */
function AiTaskRow({ task }: { task: AiTaskSummary }) {
  const href = getAiTaskHref(task.taskName);

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
    </TableRow>
  );
}
