"use client";

import { useFrameLearner } from "@/components/learner/learner-seed-provider";
import { VisitorLook } from "@/components/learner/visitor-look";
import { PublicHomeLink } from "@/components/public/public-top-bar";
import { noteAppWrite } from "@/lib/http/app-write-ledger";
import {
  type LearnerSummaryGoal,
  type LearnerSummaryWaitingGoal,
} from "@zoonk/core/learner/summary/contract";
import { GoalSwitcher } from "@zoonk/learn/goal-switcher";
import { cn } from "@zoonk/ui/lib/utils";
import { getLocalTimeZone } from "@zoonk/utils/time-zone";
import { Suspense } from "react";
import { createOnboardingGoalsAction } from "../../(onboarding)/start/onboarding-actions";
import { useOnboardingNavigation } from "../../(onboarding)/start/use-onboarding-navigation";
import { switchGoal } from "./switch-goal";

type Placement = "bar" | "sidebar";

function toSwitcherGoals(goals: readonly LearnerSummaryGoal[]) {
  return goals.flatMap(({ dailyMinutes, id, kind, status, targetDate, targetLanguage, title }) =>
    status === "archived" || (kind === "explain" && status === "completed")
      ? []
      : [{ dailyMinutes, id, kind, status, targetDate, targetLanguage, title }],
  );
}

function toSwitcherWaitingGoals(goals: readonly LearnerSummaryWaitingGoal[]) {
  return goals.flatMap(({ id, input, locked }) => {
    const [goal] = input.goals;

    return goal
      ? [
          {
            id,
            kind: goal.kind,
            locked,
            targetLanguage: goal.targetLanguage ?? null,
            title: goal.title,
          },
        ]
      : [];
  });
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
  const navigation = useOnboardingNavigation();

  if (learner.status === "visitor") {
    return <PublicHomeLink />;
  }

  if (learner.status !== "ready") {
    return <PendingGoalMenu placement={placement} />;
  }

  const { waitingGoals } = learner.summary;

  const startWaiting = async (waitingGoalId: string): Promise<boolean> => {
    const waiting = waitingGoals.find((goal) => goal.id === waitingGoalId);

    if (!waiting) {
      return false;
    }

    const outcome = await noteAppWrite(
      createOnboardingGoalsAction({ ...waiting.input, timeZone: getLocalTimeZone() }),
    );

    if (outcome.status !== "created") {
      return false;
    }

    navigation.toSteps(outcome.goalId);
    return true;
  };

  return (
    <GoalSwitcher
      activeGoalId={learner.summary.activeGoalId}
      explanationHref="/explain"
      exploreHref="/courses"
      goals={toSwitcherGoals(learner.summary.goals)}
      newGoalHref="/start"
      onSelect={switchGoal}
      onStartWaiting={startWaiting}
      placement={placement}
      waitingGoals={toSwitcherWaitingGoals(waitingGoals)}
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
