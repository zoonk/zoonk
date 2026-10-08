import { listCurrentUserGoals } from "@zoonk/core/goals/list-current-user";
import { GoalSwitcher } from "@zoonk/learn/goal-switcher";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { switchGoalAction } from "./switch-goal-action";

/**
 * The goal switcher on the left of the top bar, with the goals the learner hasn't archived. A
 * quick explanation read to the end leaves it: search finds it again.
 */
export async function LearnGoalMenu() {
  const list = await listCurrentUserGoals();

  return (
    <GoalSwitcher
      activeGoalId={list?.activeGoalId ?? null}
      explanationHref="/explain"
      exploreHref="/courses"
      goals={(list?.goals ?? []).flatMap(
        ({ dailyMinutes, id, kind, status, targetDate, targetLanguage, title }) =>
          status === "archived" || (kind === "explain" && status === "completed")
            ? []
            : [{ dailyMinutes, id, kind, status, targetDate, targetLanguage, title }],
      )}
      newGoalHref="/start"
      onSelect={switchGoalAction}
    />
  );
}

export function LearnGoalMenuSkeleton() {
  return <Skeleton className="h-11 w-36 rounded-full lg:h-10" />;
}
