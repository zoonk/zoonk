import { PublicHomeLink } from "@/components/public/public-top-bar";
import { listCurrentUserGoals } from "@zoonk/core/goals/list-current-user";
import { getSession } from "@zoonk/core/users/session";
import { GoalSwitcher } from "@zoonk/learn/goal-switcher";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { switchGoalAction } from "./switch-goal-action";

/**
 * The goal switcher on the left of the top bar (or at the top of the sidebar), with the goals the
 * learner hasn't archived and the quick explanations not read to the end (a learner with only
 * those gets the menu too). One read to the end leaves it: search finds it again. A visitor has
 * no goals to switch, so the logo takes its place and goes home, as on the public pages.
 */
export async function LearnGoalMenu({
  placement,
}: {
  /** The top bar under `lg` (the default), or the sidebar from `lg`. */
  placement?: "bar" | "sidebar";
}) {
  const [session, list] = await Promise.all([getSession(), listCurrentUserGoals()]);

  if (!session) {
    return <PublicHomeLink />;
  }

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
      placement={placement}
    />
  );
}

/** The switcher's place in the top bar while the goals are read: its 36px row. */
export function LearnGoalMenuSkeleton() {
  return <Skeleton className="h-9 w-36 rounded-lg" />;
}
