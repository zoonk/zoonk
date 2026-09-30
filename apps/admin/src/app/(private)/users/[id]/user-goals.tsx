import { AdminSection, AdminSectionEmpty } from "@/components/admin-section";
import { ProvenanceLine } from "@/components/provenance";
import { type UserGoal, listUserGoals } from "@/data/users/list-user-goals";
import { formatDate } from "@/lib/format";
import { Badge } from "@zoonk/ui/components/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@zoonk/ui/components/table";
import Link from "next/link";

function GoalRow({ goal }: { goal: UserGoal }) {
  return (
    <TableRow>
      <TableCell className="min-w-56">
        <span className="font-medium">{goal.title}</span>
        <span className="text-muted-foreground block text-xs">
          {goal.kind} · {goal.language}
          {goal.targetLanguage ? ` → ${goal.targetLanguage}` : ""}
          {goal.examBlueprint ? ` · ${goal.examBlueprint.name}` : ""}
        </span>
        {goal.primaryCourse ? (
          <Link className="text-xs underline" href={`/courses/${goal.primaryCourse.id}`}>
            {goal.primaryCourse.title}
          </Link>
        ) : null}
      </TableCell>
      <TableCell>
        <Badge className="capitalize" variant="outline">
          {goal.status}
        </Badge>
      </TableCell>
      <TableCell className="text-right tabular-nums">{goal.dailyMinutes} min</TableCell>
      <TableCell>{formatDate(goal.targetDate)}</TableCell>
      <TableCell className="text-right tabular-nums">
        {goal.plan ? `${goal.doneItems} / ${goal.plan._count.items}` : "No plan"}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {goal.plan ? `v${goal.plan.version}` : "—"}
        {goal.plan?.estimateHours ? ` · ${Math.round(goal.plan.estimateHours)} h` : ""}
      </TableCell>
      <TableCell className="text-muted-foreground">{formatDate(goal.createdAt)}</TableCell>
    </TableRow>
  );
}

function GoalTableHeader() {
  return (
    <TableHeader>
      <TableRow>
        <TableHead>Goal</TableHead>
        <TableHead>Status</TableHead>
        <TableHead className="text-right">Daily</TableHead>
        <TableHead>Target date</TableHead>
        <TableHead className="text-right">Plan items done</TableHead>
        <TableHead className="text-right">Plan</TableHead>
        <TableHead>Created</TableHead>
      </TableRow>
    </TableHeader>
  );
}

/** The latest plan changes across goals, each with its one-sentence reason and state. */
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
        <li className="flex flex-wrap items-start justify-between gap-3 py-2" key={change.id}>
          <span className="flex flex-col gap-0.5">
            <span>{change.reason}</span>
            <span className="text-muted-foreground text-xs">
              {formatDate(change.createdAt)} · {goal.title} · {change.kind} · {change.status}
            </span>
          </span>
          <ProvenanceLine provenance={change} />
        </li>
      ))}
    </ul>
  );
}

/**
 * The learner's goals and plans, then how their plans changed and why, for support questions
 * like "why did my plan move?".
 */
export async function UserGoals({ userId }: { userId: string }) {
  "use cache: private";

  const goals = await listUserGoals(userId);

  return (
    <>
      <AdminSection title="Goals and plans">
        {goals.length === 0 ? (
          <AdminSectionEmpty>No goals yet.</AdminSectionEmpty>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <GoalTableHeader />
              <TableBody>
                {goals.map((goal) => (
                  <GoalRow goal={goal} key={goal.id} />
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </AdminSection>

      <AdminSection title="Plan changes">
        <PlanChanges goals={goals} />
      </AdminSection>
    </>
  );
}
