import { type AdminTableColumn, AdminTableColumns } from "@/components/admin-table-columns";
import { AdminTableRow, AdminTableRowLink } from "@/components/admin-table-row";
import { type AdminPrompt } from "@/data/prompts/get-prompt";
import { formatDateTime } from "@/lib/format";
import { Badge } from "@zoonk/ui/components/badge";
import { TableCell } from "@zoonk/ui/components/table";

const columns: AdminTableColumn[] = [{ label: "Goal" }, { label: "Status" }, { label: "Created" }];

export function PromptGoals({ prompt }: { prompt: AdminPrompt }) {
  return (
    <AdminTableColumns
      columns={columns}
      emptyLabel="No goal was created from this prompt."
      isEmpty={prompt.goals.length === 0}
    >
      {prompt.goals.map((goal) => (
        <AdminTableRow key={goal.id}>
          <TableCell className="min-w-56">
            <span className="font-medium">{goal.title}</span>
            <span className="text-muted-foreground block text-xs">{goal.kind}</span>
            {goal.primaryCourse ? (
              <AdminTableRowLink className="text-xs" href={`/courses/${goal.primaryCourse.id}`}>
                {goal.primaryCourse.title}
              </AdminTableRowLink>
            ) : null}
          </TableCell>
          <TableCell>
            <Badge className="capitalize" variant="outline">
              {goal.status}
            </Badge>
          </TableCell>
          <TableCell className="text-muted-foreground">{formatDateTime(goal.createdAt)}</TableCell>
        </AdminTableRow>
      ))}
    </AdminTableColumns>
  );
}
