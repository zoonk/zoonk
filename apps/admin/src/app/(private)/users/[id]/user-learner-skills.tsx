import { AdminSection } from "@/components/admin-section";
import { type AdminTableColumn, AdminTableColumns } from "@/components/admin-table-columns";
import { AdminTableRow, AdminTableRowLink } from "@/components/admin-table-row";
import { MasteryMeter } from "@/components/mastery-meter";
import { StateMark } from "@/components/state-mark";
import { getUserLearnerSkills } from "@/data/users/get-user-learner-skills";
import { formatCount, formatDate } from "@/lib/format";
import { TableCell } from "@zoonk/ui/components/table";

const COLUMNS: AdminTableColumn[] = [
  { label: "Skill" },
  { label: "State" },
  { label: "Next review" },
  { align: "right", label: "Reviews" },
  { align: "right", label: "Times forgotten", size: "wide" },
  { align: "right", label: "Remembered for", size: "wide" },
];

export async function UserLearnerSkills({ userId }: { userId: string }) {
  "use cache: private";

  const { recent, states, total } = await getUserLearnerSkills(userId);

  return (
    <AdminSection title={`Skills practiced (${total.toLocaleString("en")})`}>
      {total > 0 ? <MasteryMeter states={states} /> : null}

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
            <TableCell>
              <StateMark state={learnerSkill.state} />
            </TableCell>
            <TableCell className="text-foreground">{formatDate(learnerSkill.due)}</TableCell>
            <TableCell numeric>{learnerSkill.reps}</TableCell>
            <TableCell numeric>{learnerSkill.lapses}</TableCell>
            <TableCell numeric>{formatCount(learnerSkill.recallDays, "day")}</TableCell>
          </AdminTableRow>
        ))}
      </AdminTableColumns>
    </AdminSection>
  );
}
