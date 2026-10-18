import { AdminSection } from "@/components/admin-section";
import { type AdminTableColumn, AdminTableColumns } from "@/components/admin-table-columns";
import { getUserAiSpend } from "@/data/ai/get-user-ai-spend";
import { formatUsd } from "@/lib/ai-format";
import { TableCell, TableRow } from "@zoonk/ui/components/table";
import { sumOf } from "@zoonk/utils/number";

const columns: AdminTableColumn[] = [
  { label: "Task" },
  { align: "right", label: "Calls" },
  { align: "right", label: "Cost" },
];

/**
 * What this learner's AI calls cost, shared Library content their goals caused included, so a
 * runaway account stands out next to its plan and activity.
 */
export async function UserAiSpend({ userId }: { userId: string }) {
  "use cache: private";

  const { days, tasks } = await getUserAiSpend(userId);

  return (
    <AdminSection description={`Last ${days} days, per task.`} title="AI spend">
      <AdminTableColumns columns={columns} emptyLabel="No AI calls." isEmpty={tasks.length === 0}>
        {tasks.map((row) => (
          <TableRow key={row.task}>
            <TableCell className="font-mono text-xs">{row.task}</TableCell>
            <TableCell className="text-right tabular-nums">{row.calls.toLocaleString()}</TableCell>
            <TableCell className="text-right tabular-nums">{formatUsd(row.costUsd)}</TableCell>
          </TableRow>
        ))}
        <TableRow className="font-medium">
          <TableCell>All tasks</TableCell>
          <TableCell className="text-right tabular-nums">
            {sumOf(tasks.map((row) => row.calls)).toLocaleString()}
          </TableCell>
          <TableCell className="text-right tabular-nums">
            {formatUsd(sumOf(tasks.map((row) => row.costUsd)))}
          </TableCell>
        </TableRow>
      </AdminTableColumns>
    </AdminSection>
  );
}
