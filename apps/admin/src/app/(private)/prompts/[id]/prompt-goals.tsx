import { type AdminTableColumn, AdminTableColumns } from "@/components/admin-table-columns";
import { AdminTableRow, AdminTableRowLink } from "@/components/admin-table-row";
import { type AdminPrompt } from "@/data/prompts/get-prompt";
import { formatDateTime, toWords } from "@/lib/format";
import { TableCell } from "@zoonk/ui/components/table";

const columns: AdminTableColumn[] = [
  { label: "Goal" },
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
            <span className="font-medium">{goal.title}</span>
            <span className="text-muted-foreground block text-xs">{toWords(goal.kind)}</span>
            {goal.primaryCourse ? (
              <AdminTableRowLink className="text-xs" href={`/courses/${goal.primaryCourse.id}`}>
                {goal.primaryCourse.title}
              </AdminTableRowLink>
            ) : null}
          </TableCell>
          <TableCell>{toWords(goal.status)}</TableCell>
          <TableCell className="text-muted-foreground">{formatDateTime(goal.createdAt)}</TableCell>
        </AdminTableRow>
      ))}
    </AdminTableColumns>
  );
}
