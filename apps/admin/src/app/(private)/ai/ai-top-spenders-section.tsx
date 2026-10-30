import { AdminSection } from "@/components/admin-section";
import { type AdminTableColumn, AdminTableColumns } from "@/components/admin-table-columns";
import { AdminTableRow, AdminTableRowLink } from "@/components/admin-table-row";
import { listTopAiSpenders } from "@/data/ai/list-top-ai-spenders";
import { formatUsd } from "@/lib/ai-format";
import { TableCell } from "@zoonk/ui/components/table";

const goalColumns: AdminTableColumn[] = [
  { label: "Goal" },
  { label: "Learner" },
  { align: "right", label: "Calls" },
  { align: "right", label: "Cost" },
];

const learnerColumns: AdminTableColumn[] = [
  { label: "Learner" },
  { align: "right", label: "Calls" },
  { align: "right", label: "Cost" },
];

type TopSpenders = Awaited<ReturnType<typeof listTopAiSpenders>>;

function GoalSpenders({ goals }: { goals: TopSpenders["goals"] }) {
  return (
    <AdminTableColumns
      columns={goalColumns}
      emptyLabel="No goal spent anything."
      isEmpty={goals.length === 0}
    >
      {goals.map((row) => (
        <AdminTableRow key={row.id}>
          <TableCell>
            {row.goal ? `${row.goal.title} (${row.goal.kind})` : "Deleted goal"}
          </TableCell>
          <TableCell>
            {row.goal ? (
              <AdminTableRowLink href={`/users/${row.goal.user.id}`} prefetch>
                {row.goal.user.email}
              </AdminTableRowLink>
            ) : (
              "—"
            )}
          </TableCell>
          <TableCell className="text-right tabular-nums">{row.calls.toLocaleString()}</TableCell>
          <TableCell className="text-right font-medium tabular-nums">
            {formatUsd(row.costUsd)}
          </TableCell>
        </AdminTableRow>
      ))}
    </AdminTableColumns>
  );
}

function LearnerSpenders({ learners }: { learners: TopSpenders["learners"] }) {
  return (
    <AdminTableColumns
      columns={learnerColumns}
      emptyLabel="No learner spent anything."
      isEmpty={learners.length === 0}
    >
      {learners.map((row) => (
        <AdminTableRow key={row.id}>
          <TableCell>
            <AdminTableRowLink href={`/users/${row.id}`} prefetch>
              {row.user?.isAnonymous ? "Guest" : (row.user?.name ?? row.user?.email ?? "Deleted")}
            </AdminTableRowLink>
            {row.user && !row.user.isAnonymous ? (
              <span className="text-muted-foreground block text-xs">{row.user.email}</span>
            ) : null}
          </TableCell>
          <TableCell className="text-right tabular-nums">{row.calls.toLocaleString()}</TableCell>
          <TableCell className="text-right font-medium tabular-nums">
            {formatUsd(row.costUsd)}
          </TableCell>
        </AdminTableRow>
      ))}
    </AdminTableColumns>
  );
}

export async function AiTopSpendersSection({ days }: { days: number }) {
  const { goals, learners } = await listTopAiSpenders(days);

  return (
    <>
      <AdminSection description={`Top 20 in the last ${days} days.`} title="Top goals">
        <GoalSpenders goals={goals} />
      </AdminSection>

      <AdminSection description={`Top 20 in the last ${days} days.`} title="Top learners">
        <LearnerSpenders learners={learners} />
      </AdminSection>
    </>
  );
}
