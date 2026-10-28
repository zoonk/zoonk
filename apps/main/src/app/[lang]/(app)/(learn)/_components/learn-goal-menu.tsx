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

function toSwitcherGoals(goals: readonly LearnerSummaryGoal[]) {
  return goals.flatMap(({ dailyMinutes, id, kind, status, targetDate, targetLanguage, title }) =>
    status === "archived" || (kind === "explain" && status === "completed")
      ? []
      : [{ dailyMinutes, id, kind, status, targetDate, targetLanguage, title }],
  );
}

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

/** An explanation read to the end leaves the switcher: search finds it again. */
export function LearnGoalMenu({ placement }: { placement?: Placement }) {
  return (
    <Suspense fallback={<PendingGoalMenu placement={placement} />}>
      <GoalMenu placement={placement} />
    </Suspense>
  );
}
