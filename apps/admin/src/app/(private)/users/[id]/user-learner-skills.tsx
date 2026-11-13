import { AdminSection } from "@/components/admin-section";
import { type AdminTableColumn, AdminTableColumns } from "@/components/admin-table-columns";
import { AdminTableRow, AdminTableRowLink } from "@/components/admin-table-row";
import { getUserLearnerSkills } from "@/data/users/get-user-learner-skills";
import { formatCount, formatDate, toWords } from "@/lib/format";
import { TableCell } from "@zoonk/ui/components/table";

const COLUMNS: AdminTableColumn[] = [
  { label: "Skill" },
  { label: "State" },
  { label: "Next review" },
  { align: "right", label: "Reviews" },
  { align: "right", label: "Times forgotten", size: "wide" },
  { align: "right", label: "Remembered for", size: "wide" },
  { label: "Last review" },
];

export async function UserLearnerSkills({ userId }: { userId: string }) {
  "use cache: private";

  const { recent, states, total } = await getUserLearnerSkills(userId);

  return (
    <AdminSection
      description={states.map((row) => `${row.count} ${row.state}`).join(" · ")}
      title={`Skills practiced (${total.toLocaleString("en")})`}
    >
      <AdminTableColumns
        columns={COLUMNS}
        emptyLabel="No skills practiced yet."
        isEmpty={recent.length === 0}
      >
        {recent.map((learnerSkill) => (
          <AdminTableRow key={learnerSkill.id}>
            <TableCell className="min-w-56 whitespace-normal">
              <AdminTableRowLink href={`/skills/${learnerSkill.skill.id}`}>
                {learnerSkill.skill.name}
              </AdminTableRowLink>
            </TableCell>
            <TableCell>{toWords(learnerSkill.state)}</TableCell>
            <TableCell>{formatDate(learnerSkill.due)}</TableCell>
            <TableCell className="text-right tabular-nums">{learnerSkill.reps}</TableCell>
            <TableCell className="text-right tabular-nums">{learnerSkill.lapses}</TableCell>
            <TableCell className="text-right tabular-nums">
              {formatCount(learnerSkill.recallDays, "day")}
            </TableCell>
            <TableCell className="text-muted-foreground">
              {formatDate(learnerSkill.lastReviewedAt)}
            </TableCell>
          </AdminTableRow>
        ))}
      </AdminTableColumns>
    </AdminSection>
  );
}
