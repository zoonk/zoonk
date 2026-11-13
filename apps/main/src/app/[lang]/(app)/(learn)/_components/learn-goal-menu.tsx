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
  return goals.flatMap(
    ({
      dailyMinutes,
      displayName,
      id,
      kind,
      languageFlag,
      status,
      targetDate,
      targetLanguage,
      targetRegion,
    }) =>
      status === "archived" || (kind === "explain" && status === "completed")
        ? []
        : [
            {
              dailyMinutes,
              displayName,
              id,
              kind,
              languageFlag,
              status,
              targetDate,
              targetLanguage,
              targetRegion,
            },
          ],
  );
}

function toSwitcherWaitingGoals(goals: readonly LearnerSummaryWaitingGoal[]) {
  return goals.flatMap(({ id, input, languageFlag, locked, displayName }) => {
    const [goal] = input.goals;

    return goal
      ? [
          {
            displayName,
            id,
            languageFlag,
            locked,
            targetLanguage: goal.targetLanguage ?? null,
            targetRegion: goal.targetRegion ?? null,
          },
        ]
      : [];
  });
}

/** In the sidebar the 24px logo centers on the items' icons, like the account's picture. */
function SidebarHomeLink() {
  return (
    <span className="flex px-1">
      <PublicHomeLink />
    </span>
  );
}

type GoalMenuProps = {
  placement?: Placement;
  /** What someone without a session gets in the menu's place; the logo when left out. */
  visitor?: React.ReactNode;
};

function getVisitorStart({ placement, visitor }: GoalMenuProps): React.ReactNode {
  if (visitor) {
    return visitor;
  }

  return placement === "sidebar" ? <SidebarHomeLink /> : <PublicHomeLink />;
}

function PendingGoalMenu({ placement = "bar", visitor }: GoalMenuProps) {
  return (
    <>
      <VisitorLook>{getVisitorStart({ placement, visitor })}</VisitorLook>
      <div
        aria-hidden="true"
        className={cn("signed-in:block hidden", placement === "sidebar" ? "h-8 w-full" : "h-9")}
      />
    </>
  );
}

function GoalMenu({ placement, visitor }: GoalMenuProps) {
  const learner = useFrameLearner();
  const navigation = useOnboardingNavigation();

  if (learner.status === "visitor") {
    return getVisitorStart({ placement, visitor });
  }

  if (learner.status !== "ready") {
    return <PendingGoalMenu placement={placement} visitor={visitor} />;
  }

  const { waitingGoals } = learner.summary;

  const startWaiting = async ({
    pauseGoalId,
    waitingGoalId,
  }: {
    pauseGoalId?: string;
    waitingGoalId: string;
  }): Promise<boolean> => {
    const waiting = waitingGoals.find((goal) => goal.id === waitingGoalId);

    if (!waiting) {
      return false;
    }

    const outcome = await noteAppWrite(
      createOnboardingGoalsAction({ ...waiting.input, pauseGoalId, timeZone: getLocalTimeZone() }),
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
      hasAccount={!learner.summary.identity.isAnonymous}
      newGoalHref="/start"
      onSelect={switchGoal}
      onStartWaiting={startWaiting}
      placement={placement}
      waitingGoals={toSwitcherWaitingGoals(waitingGoals)}
    />
  );
}

/** An explanation read to the end leaves the switcher: search finds it again. */
export function LearnGoalMenu(props: GoalMenuProps) {
  return (
    <Suspense fallback={<PendingGoalMenu {...props} />}>
      <GoalMenu {...props} />
    </Suspense>
  );
}
