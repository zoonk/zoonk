"use client";

import { useFrameLearner } from "@/components/learner/learner-seed-provider";
import { VisitorLook } from "@/components/learner/visitor-look";
import { PublicHomeLink } from "@/components/public/public-top-bar";
import { type LearnerSummaryGoal } from "@zoonk/core/learner/summary/contract";
import { GoalSwitcher } from "@zoonk/learn/goal-switcher";
import { cn } from "@zoonk/ui/lib/utils";
import { Suspense } from "react";
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

/**
 * The switcher's place while the learner is unread: a visitor's logo, or on a page marked signed in
 * the switcher's row left empty (32px in the sidebar, 36px in the bar) for the goal to fill.
 */
function PendingGoalMenu({ placement = "bar" }: { placement?: Placement }) {
  return (
    <>
      <VisitorLook>
        <PublicHomeLink />
      </VisitorLook>
      <div
        aria-hidden="true"
        className={cn("signed-in:block hidden", placement === "sidebar" ? "h-8 w-full" : "h-9")}
      />
    </>
  );
}

function GoalMenu({ placement }: { placement?: Placement }) {
  const learner = useFrameLearner();

  if (learner.status === "visitor") {
    return <PublicHomeLink />;
  }

  if (learner.status !== "ready") {
    return <PendingGoalMenu placement={placement} />;
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
  return (
    <Suspense fallback={<PendingGoalMenu placement={placement} />}>
      <GoalMenu placement={placement} />
    </Suspense>
  );
}
