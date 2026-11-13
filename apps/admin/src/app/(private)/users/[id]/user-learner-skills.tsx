import { AdminSection } from "@/components/admin-section";
import { type AdminTableColumn, AdminTableColumns } from "@/components/admin-table-columns";
import { AdminTableRow, AdminTableRowLink } from "@/components/admin-table-row";
import { StateMark } from "@/components/state-mark";
import { getUserLearnerSkills } from "@/data/users/get-user-learner-skills";
import { formatCount, formatDate, toWords } from "@/lib/format";
import { type MasteryState } from "@zoonk/db/enums";
import { MeterPart, MeterParts } from "@zoonk/learn/meter";
import { TableCell } from "@zoonk/ui/components/table";

const COLUMNS: AdminTableColumn[] = [
  { label: "Skill" },
  { label: "State" },
  { label: "Next review" },
  { align: "right", label: "Reviews" },
  { align: "right", label: "Times forgotten", size: "wide" },
  { align: "right", label: "Remembered for", size: "wide" },
];

/** How far each skill is, weakest first: one blue that deepens as the skill settles. */
const MASTERY: { fill: string; state: MasteryState }[] = [
  { fill: "bg-surface-3", state: "new" },
  { fill: "bg-success/30", state: "learning" },
  { fill: "bg-success/60", state: "solid" },
  { fill: "bg-success", state: "mastered" },
];

type StateCount = { count: number; state: MasteryState };

/** The whole set at a glance: a part per state, sized by how many skills are in it, then its key. */
function MasteryMeter({ states }: { states: StateCount[] }) {
  const parts = MASTERY.flatMap(({ fill, state }) => {
    const count = states.find((row) => row.state === state)?.count ?? 0;
    return count > 0 ? [{ count, fill, state }] : [];
  });

  return (
    <div className="flex flex-col gap-2.5">
      <MeterParts>
        {parts.map((part) => (
          <MeterPart className={part.fill} key={part.state} weight={part.count} />
        ))}
      </MeterParts>
      <ul className="text-muted-foreground flex flex-wrap gap-x-5 gap-y-1 text-xs">
        {parts.map((part) => (
          <li className="flex items-center gap-1.5" key={part.state}>
            <span aria-hidden="true" className={`size-2.5 rounded-xs ${part.fill}`} />
            {toWords(part.state)}
            <span className="text-foreground font-mono tabular-nums">{part.count}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

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
