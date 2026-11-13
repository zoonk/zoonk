import { type AdminTableColumn, AdminTableColumns } from "@/components/admin-table-columns";
import { AdminTableRow } from "@/components/admin-table-row";
import { GoalKindIcon } from "@/components/goal-kind-icon";
import { StateMark } from "@/components/state-mark";
import { type AdminPrompt } from "@/data/prompts/get-prompt";
import { formatDateTime, toWords } from "@/lib/format";
import { TableCell } from "@zoonk/ui/components/table";
import Link from "next/link";

const columns: AdminTableColumn[] = [
  { label: "Goal", twoLines: true },
  { label: "State" },
  { label: "Created", size: "text" },
];

export function PromptGoals({ prompt }: { prompt: AdminPrompt }) {
  return (
    <AdminTableColumns
      columns={columns}
      emptyLabel="No goal came from this request."
      isEmpty={prompt.goals.length === 0}
    >
      {prompt.goals.map((goal) => (
        <AdminTableRow key={goal.id}>
          <TableCell>
            <span className="flex min-w-0 items-start gap-2.5">
              <span className="flex h-5 shrink-0 items-center">
                <GoalKindIcon kind={goal.kind} />
              </span>
              <span className="min-w-0">
                <span className="text-foreground block font-medium">{goal.title}</span>
                {goal.primaryCourse ? (
                  <Link
                    className="hit-area relative text-xs underline underline-offset-3"
                    href={`/courses/${goal.primaryCourse.id}`}
                    prefetch
                  >
                    {goal.primaryCourse.title}
                  </Link>
                ) : (
                  <span className="block text-xs">{toWords(goal.kind)}</span>
                )}
              </span>
            </span>
          </TableCell>
          <TableCell>
            <StateMark state={goal.status} />
          </TableCell>
          <TableCell>{formatDateTime(goal.createdAt)}</TableCell>
        </AdminTableRow>
      ))}
    </AdminTableColumns>
  );
}
