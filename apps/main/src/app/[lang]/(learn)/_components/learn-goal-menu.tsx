import { listCurrentUserGoals } from "@zoonk/core/goals/list-current-user";
import { GoalSwitcher } from "@zoonk/learn/goal-switcher";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { switchGoalAction } from "./switch-goal-action";

/** The goal switcher on the left of the top bar, with every goal the learner hasn't archived. */
export async function LearnGoalMenu() {
  const list = await listCurrentUserGoals();

  return (
    <GoalSwitcher
      activeGoalId={list?.activeGoalId ?? null}
      dailyMinutes={list?.dailyMinutes ?? 0}
      exploreHref="/courses"
      goals={(list?.goals ?? []).map(
        ({ dailyMinutes, id, kind, status, targetLanguage, title }) => ({
          dailyMinutes: status === "active" ? dailyMinutes : null,
          id,
          kind,
          targetLanguage,
          title,
        }),
      )}
      newGoalHref="/start"
      onSelect={switchGoalAction}
    />
  );
}

export function LearnGoalMenuSkeleton() {
  return <Skeleton className="h-11 w-36 rounded-full lg:h-10" />;
}
