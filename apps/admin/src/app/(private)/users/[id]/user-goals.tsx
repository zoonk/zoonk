import { AdminSection, AdminSectionEmpty } from "@/components/admin-section";
import { GoalKindIcon } from "@/components/goal-kind-icon";
import { StateMark } from "@/components/state-mark";
import { type UserGoal, listUserGoals } from "@/data/users/list-user-goals";
import { formatDate, toWords } from "@/lib/format";
import { Meter, MeterFill } from "@zoonk/ui/components/meter";
import {
  CalendarXIcon,
  FastForwardIcon,
  HourglassIcon,
  ListTreeIcon,
  type LucideIcon,
  PencilLineIcon,
  PlayIcon,
  RotateCcwIcon,
  RouteIcon,
} from "lucide-react";
import Link from "next/link";

function goalFacts(goal: UserGoal): string {
  return [
    toWords(goal.kind),
    goal.targetLanguage
      ? `${goal.language.toUpperCase()} → ${goal.targetLanguage.toUpperCase()}`
      : goal.language.toUpperCase(),
    goal.examBlueprint?.name,
  ]
    .filter(Boolean)
    .join(" · ");
}

/** A goal as the learner's plan shows it: how much of it is done, drawn, then its pace and date. */
function GoalProgress({ children, goal }: { children?: React.ReactNode; goal: UserGoal }) {
  const title = <span className="text-sm font-medium">{goal.title}</span>;

  return (
    <li className="flex flex-col gap-2.5 py-3.5">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-sm">
        <span className="flex min-w-0 items-center gap-2">
          <GoalKindIcon kind={goal.kind} />
          {goal.primaryCourse ? (
            <Link
              className="hit-area relative underline-offset-3 hover:underline"
              href={`/courses/${goal.primaryCourse.id}`}
              prefetch
            >
              {title}
            </Link>
          ) : (
            title
          )}
          <span className="text-muted-foreground text-xs">{goalFacts(goal)}</span>
        </span>
        <StateMark className="text-muted-foreground" state={goal.status} />
      </div>

      {goal.plan ? (
        <Meter>
          <MeterFill
            className="bg-success"
            share={goal.totalItems > 0 ? goal.doneItems / goal.totalItems : 0}
          />
        </Meter>
      ) : null}

      <div className="text-muted-foreground text-compact flex flex-wrap justify-between gap-x-4 gap-y-1">
        <span>
          {goal.plan ? (
            <>
              Plan:{" "}
              <span className="text-foreground font-mono tabular-nums">
                {goal.doneItems.toLocaleString("en")}
              </span>{" "}
              of {goal.totalItems.toLocaleString("en")} done
            </>
          ) : (
            "No plan"
          )}
        </span>
        <span>
          {goal.dailyMinutes} min a day
          {goal.targetDate ? ` · By ${formatDate(goal.targetDate)}` : ""}
        </span>
        {children ? <span className="basis-full">{children}</span> : null}
      </div>
    </li>
  );
}

/** Overview: what they're studying and how far they are. A goal's name opens its course. */
export async function UserGoals({ userId }: { userId: string }) {
  "use cache: private";

  const goals = await listUserGoals(userId);

  return (
    <AdminSection title={goals.length === 1 ? "Goal" : "Goals"}>
      {goals.length === 0 ? (
        <AdminSectionEmpty>No goals yet.</AdminSectionEmpty>
      ) : (
        <ul className="-my-3.5 flex flex-col divide-y">
          {goals.map((goal) => (
            <GoalProgress goal={goal} key={goal.id} />
          ))}
        </ul>
      )}
    </AdminSection>
  );
}

/** What changed a plan, as its mark: the learner's own edit, days missed, something tested out. */
const CHANGE_ICONS: Partial<Record<string, LucideIcon>> = {
  coverageChanged: ListTreeIcon,
  edited: PencilLineIcon,
  estimateUpdated: HourglassIcon,
  missedDays: CalendarXIcon,
  relearn: RotateCcwIcon,
  resumed: PlayIcon,
  testedOut: FastForwardIcon,
};

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
    <ol className="-my-3 flex flex-col divide-y text-sm">
      {changes.map(({ change, goal }) => {
        const Icon = CHANGE_ICONS[change.kind] ?? RouteIcon;

        return (
          <li className="flex items-start gap-3 py-3" key={change.id}>
            <Icon aria-hidden="true" className="text-muted-foreground mt-0.5 size-4 shrink-0" />
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="flex flex-wrap items-baseline justify-between gap-x-4">
                <span className="font-medium">{toWords(change.kind)}</span>
                <span className="text-muted-foreground text-xs">
                  {formatDate(change.createdAt)}
                </span>
              </span>
              <span className="text-muted-foreground max-w-column text-pretty">
                {change.reason}
              </span>
              <span className="text-muted-foreground flex flex-wrap items-center gap-x-3 text-xs">
                <StateMark state={change.status} />
                {goals.length > 1 ? <span>{goal.title}</span> : null}
                {change.model ? (
                  <span>
                    Written by{" "}
                    {[change.model, change.promptVersion].filter(Boolean).join(", prompt ")}
                  </span>
                ) : null}
              </span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/** The Plan tab: each goal's plan drawn as on the Overview, with what the plan itself is, then every change made to it, newest first. */
export async function UserPlans({ userId }: { userId: string }) {
  "use cache: private";

  const goals = await listUserGoals(userId);

  return (
    <>
      <AdminSection title={goals.length === 1 ? "Plan" : "Plans"}>
        {goals.length === 0 ? (
          <AdminSectionEmpty>No goals yet.</AdminSectionEmpty>
        ) : (
          <ul className="-my-3.5 flex flex-col divide-y">
            {goals.map((goal) => (
              <GoalProgress goal={goal} key={goal.id}>
                {goal.plan ? (
                  <span>
                    Version {goal.plan.version}
                    {goal.plan.estimateHours
                      ? ` · About ${Math.round(goal.plan.estimateHours)} hours of study`
                      : ""}
                    {` · Goal created ${formatDate(goal.createdAt)}`}
                  </span>
                ) : null}
              </GoalProgress>
            ))}
          </ul>
        )}
      </AdminSection>

      <AdminSection title="Plan changes">
        <PlanChanges goals={goals} />
      </AdminSection>
    </>
  );
}
