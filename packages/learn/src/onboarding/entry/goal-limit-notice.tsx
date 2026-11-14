"use client";

import { buttonVariants } from "@zoonk/ui/components/button";
import { useExtracted } from "next-intl";
import { useLiveWords } from "../../_components/comes-back-words";
import { GateWords, SubscribeGate, SubscribeMainAction } from "../../_components/subscribe-gate";
import { useLearnRoutes } from "../../learn-context";
import { LearnLink } from "../../learn-link";
import { useGoalLimitWords } from "../goal-errors";
import { type GoalLimit, type GoalLimitReason } from "../onboarding-actions";
import { ONBOARDING_ACTION_LINK_CLASS, OnboardingBottomBar } from "../onboarding-frame";

export function isPlusGoalLimit(reason: GoalLimitReason): boolean {
  return reason === "activeGoals" || reason === "monthlyGoals";
}

/** What the gate says when the learner's plan has no room for another goal. */
function usePlusLimitWords(limit: GoalLimit): { line?: string; title: string } | null {
  const { line, title } = useLiveWords(useGoalLimitWords()(limit));
  return isPlusGoalLimit(limit.reason) && title ? { line, title } : null;
}

function PlanLink({ className }: { className: string }) {
  const t = useExtracted();
  const routes = useLearnRoutes();

  return (
    <LearnLink className={className} href={routes.journey}>
      {t("Go to your Plan")}
    </LearnLink>
  );
}

/** The gate a learner meets on trying to start a goal their plan has no room for. */
export function GoalLimitNotice({ limit }: { limit: GoalLimit }) {
  const words = usePlusLimitWords(limit);

  if (!words) {
    return null;
  }

  return (
    <SubscribeGate
      action={
        limit.reason === "activeGoals" && (
          <PlanLink className={buttonVariants({ size: "sm", variant: "outline" })} />
        )
      }
      title={words.title}
    >
      {words.line}
    </SubscribeGate>
  );
}

/**
 * The gate as an onboarding screen's bar: Subscribe as the main action, and the Plan, where a goal
 * can be paused, before it. `words` puts the gate's words over the bar, for a screen whose own title
 * isn't the gate's.
 */
export function GoalLimitBar({ limit, words }: { limit: GoalLimit; words?: boolean }) {
  const said = usePlusLimitWords(limit);

  if (!said) {
    return null;
  }

  return (
    <OnboardingBottomBar note={words && <GateWords line={said.line} title={said.title} />}>
      <SubscribeMainAction
        action={
          limit.reason === "activeGoals" && (
            <PlanLink className={ONBOARDING_ACTION_LINK_CLASS.other} />
          )
        }
      />
    </OnboardingBottomBar>
  );
}
