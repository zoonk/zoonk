import { AdminSection, AdminSectionEmpty } from "@/components/admin-section";
import { type AdminTableColumn, AdminTableColumns } from "@/components/admin-table-columns";
import { AdminTableRow, AdminTableRowLink } from "@/components/admin-table-row";
import { type UserGoal, listUserGoals } from "@/data/users/list-user-goals";
import { formatDate, toWords } from "@/lib/format";
import { TableCell } from "@zoonk/ui/components/table";

const GOAL_COLUMNS: AdminTableColumn[] = [
  { label: "Goal" },
  { label: "State" },
  { align: "right", label: "Time a day" },
  { label: "Date" },
  { align: "right", label: "Plan" },
];

const PLAN_COLUMNS: AdminTableColumn[] = [
  { label: "Goal" },
  { align: "right", label: "Plan version" },
  { align: "right", label: "Estimate" },
  { label: "Goal created" },
];

function GoalName({ goal }: { goal: UserGoal }) {
  const facts = [
    toWords(goal.kind),
    goal.targetLanguage
      ? `${goal.language.toUpperCase()} → ${goal.targetLanguage.toUpperCase()}`
      : goal.language.toUpperCase(),
    goal.examBlueprint?.name,
  ];

  return (
    <>
      <span className="font-medium">{goal.title}</span>
      <span className="text-muted-foreground block text-xs">
        {facts.filter(Boolean).join(" · ")}
      </span>
    </>
  );
}

function GoalRow({ goal }: { goal: UserGoal }) {
  return (
    <AdminTableRow>
      <TableCell className="min-w-56 whitespace-normal">
        {goal.primaryCourse ? (
          <AdminTableRowLink className="block" href={`/courses/${goal.primaryCourse.id}`}>
            <GoalName goal={goal} />
          </AdminTableRowLink>
        ) : (
          <GoalName goal={goal} />
        )}
      </TableCell>
      <TableCell>{toWords(goal.status)}</TableCell>
      <TableCell className="text-right tabular-nums">{goal.dailyMinutes} min</TableCell>
      <TableCell>{formatDate(goal.targetDate)}</TableCell>
      <TableCell className="text-right tabular-nums">
        {goal.plan
          ? `${goal.doneItems.toLocaleString("en")} of ${goal.totalItems.toLocaleString("en")} done`
          : "No plan"}
      </TableCell>
    </AdminTableRow>
  );
}

/** Overview: what they're studying and how far they are. A row opens the goal's course. */
export async function UserGoals({ userId }: { userId: string }) {
  "use cache: private";

  const goals = await listUserGoals(userId);

  return (
    <AdminSection title="Goals">
      <AdminTableColumns
        columns={GOAL_COLUMNS}
        emptyLabel="No goals yet."
        isEmpty={goals.length === 0}
      >
        {goals.map((goal) => (
          <GoalRow goal={goal} key={goal.id} />
        ))}
      </AdminTableColumns>
    </AdminSection>
  );
}

function PlanChanges({ goals }: { goals: UserGoal[] }) {
  const changes = goals
    .flatMap((goal) => (goal.plan?.changes ?? []).map((change) => ({ change, goal })))
    .toSorted(
      (first, second) => second.change.createdAt.getTime() - first.change.createdAt.getTime(),
    );

  if (changes.length === 0) {
    return <AdminSectionEmpty>No plan changes yet.</AdminSectionEmpty>;
  }

  return (
    <ul className="flex flex-col divide-y text-sm">
      {changes.map(({ change, goal }) => (
        <li className="flex flex-col gap-0.5 py-2.5" key={change.id}>
          <span className="max-w-3xl">{change.reason}</span>
          <span className="text-muted-foreground text-xs">
            {[
              formatDate(change.createdAt),
              goals.length > 1 && goal.title,
              toWords(change.kind),
              toWords(change.status),
              change.model &&
                `Written by ${[change.model, change.promptVersion].filter(Boolean).join(", prompt ")}`,
            ]
              .filter(Boolean)
              .join(" · ")}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** The Plan tab: each goal's plan, then every change made to them, newest first. */
export async function UserPlans({ userId }: { userId: string }) {
  "use cache: private";

  const goals = await listUserGoals(userId);

  return (
    <>
      <AdminSection title="Plans">
        <AdminTableColumns
          columns={PLAN_COLUMNS}
          emptyLabel="No goals yet."
          isEmpty={goals.length === 0}
        >
          {goals.map((goal) => (
            <AdminTableRow key={goal.id}>
              <TableCell className="min-w-56 whitespace-normal">
                <GoalName goal={goal} />
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {goal.plan ? goal.plan.version : "No plan"}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {goal.plan?.estimateHours ? `${Math.round(goal.plan.estimateHours)} h` : "—"}
              </TableCell>
              <TableCell className="text-muted-foreground">{formatDate(goal.createdAt)}</TableCell>
            </AdminTableRow>
          ))}
        </AdminTableColumns>
      </AdminSection>

      <AdminSection title="Plan changes">
        <PlanChanges goals={goals} />
      </AdminSection>
    </>
  );
}
