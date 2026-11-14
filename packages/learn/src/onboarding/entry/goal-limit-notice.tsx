"use client";

import { buttonVariants } from "@zoonk/ui/components/button";
import { useExtracted } from "next-intl";
import { useCapLine } from "../../_components/help-limit-notice";
import { GateWords, SubscribeGate, SubscribeMainAction } from "../../_components/subscribe-gate";
import { useLearnRoutes } from "../../learn-context";
import { LearnLink } from "../../learn-link";
import { type GoalLimitReason } from "../onboarding-actions";
import { ONBOARDING_ACTION_LINK_CLASS, OnboardingBottomBar } from "../onboarding-frame";

export function isPlusGoalLimit(reason: GoalLimitReason): boolean {
  return reason === "activeGoals" || reason === "monthlyGoals";
}

type GoalLimitWords = { line?: string; title: string };

/** What the gate says when the learner's plan has no room for another goal. */
export function useGoalLimitWords(reason: GoalLimitReason): GoalLimitWords | null {
  const t = useExtracted();
  const monthLine = useCapLine({ period: "month", tier: "free" });

  if (!isPlusGoalLimit(reason)) {
    return null;
  }

  return reason === "activeGoals"
    ? {
        line: t("Pause one in your Plan, or subscribe to study more at once."),
        title: t("That's all the goals you can study at once"),
      }
    : { line: monthLine, title: t("No more new goals this month") };
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
export function GoalLimitNotice({ reason }: { reason: GoalLimitReason }) {
  const words = useGoalLimitWords(reason);

  if (!words) {
    return null;
  }

  return (
    <SubscribeGate
      action={
        reason === "activeGoals" && (
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
export function GoalLimitBar({ reason, words }: { reason: GoalLimitReason; words?: boolean }) {
  const said = useGoalLimitWords(reason);

  if (!said) {
    return null;
  }

  return (
    <OnboardingBottomBar note={words && <GateWords line={said.line} title={said.title} />}>
      <SubscribeMainAction
        action={
          reason === "activeGoals" && <PlanLink className={ONBOARDING_ACTION_LINK_CLASS.other} />
        }
      />
    </OnboardingBottomBar>
  );
}
