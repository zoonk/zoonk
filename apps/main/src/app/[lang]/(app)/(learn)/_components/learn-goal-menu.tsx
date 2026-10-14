"use client";

import { PublicHomeLink } from "@/components/public/public-top-bar";
import { useLearnerSummary } from "@/lib/learner/use-learner-summary";
import { type LearnerSummaryGoal } from "@zoonk/core/learner/summary/contract";
import { GoalSwitcher } from "@zoonk/learn/goal-switcher";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { switchGoal } from "./switch-goal";

type Placement = "bar" | "sidebar";

/** The goals the switcher lists: not archived, and no explanation already read to the end. */
function toSwitcherGoals(goals: readonly LearnerSummaryGoal[]) {
  return goals.flatMap(({ dailyMinutes, id, kind, status, targetDate, targetLanguage, title }) =>
    status === "archived" || (kind === "explain" && status === "completed")
      ? []
      : [{ dailyMinutes, id, kind, status, targetDate, targetLanguage, title }],
  );
}

/** The switcher's place while the learner's goals are read: its row in the bar or the sidebar. */
function LearnGoalMenuSkeleton({ placement = "bar" }: { placement?: Placement }) {
  return placement === "sidebar" ? (
    <Skeleton className="h-8 w-full rounded-md" />
  ) : (
    <Skeleton className="h-9 w-36 rounded-lg" />
  );
}

/**
 * The goal switcher on the left of the top bar (or at the top of the sidebar), with the goals the
 * learner hasn't archived and the quick explanations not read to the end (a learner with only
 * those gets the menu too). One read to the end leaves it: search finds it again. A visitor has
 * no goals to switch, so the logo takes its place and goes home, as on the public pages.
 */
export function LearnGoalMenu({
  placement,
}: {
  /** The top bar under `lg` (the default), or the sidebar from `lg`. */
  placement?: Placement;
}) {
  const learner = useLearnerSummary();

  if (learner.status === "visitor") {
    return <PublicHomeLink />;
  }

  if (learner.status !== "ready") {
    return <LearnGoalMenuSkeleton placement={placement} />;
  }

  return (
    <GoalSwitcher
      activeGoalId={learner.summary.activeGoalId}
      explanationHref="/explain"
      exploreHref="/courses"
      goals={toSwitcherGoals(learner.summary.goals)}
      newGoalHref="/start"
      onSelect={switchGoal}
      placement={placement}
    />
  );
}
