"use client";

import { buttonVariants } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { useCapLine } from "../../_components/help-limit-notice";
import { SubscribeGate } from "../../_components/subscribe-gate";
import { useLearnRoutes } from "../../learn-context";
import { LearnLink } from "../../learn-link";
import { useGoalLimitMessage } from "../goal-errors";
import { type GoalLimitReason } from "../onboarding-actions";

export function isPlusGoalLimit(reason: GoalLimitReason): boolean {
  return reason === "activeGoals" || reason === "monthlyGoals";
}

/** The gate a learner meets on trying to start a goal their plan has no room for. */
export function GoalLimitNotice({ reason }: { reason: GoalLimitReason }) {
  const t = useExtracted();
  const routes = useLearnRoutes();
  const monthLine = useCapLine({ period: "month", tier: "free" });

  if (!isPlusGoalLimit(reason)) {
    return null;
  }

  if (reason !== "activeGoals") {
    return <SubscribeGate title={t("No more new goals this month")}>{monthLine}</SubscribeGate>;
  }

  return (
    <SubscribeGate
      action={
        <LearnLink
          className={buttonVariants({ size: "sm", variant: "outline" })}
          href={routes.journey}
        >
          {t("Go to your Plan")}
        </LearnLink>
      }
      title={t("That's all the goals you can study at once")}
    >
      {t("Pause one in your Plan, or subscribe to study more at once.")}
    </SubscribeGate>
  );
}

export function GoalLimitWall({ reason }: { reason: GoalLimitReason }) {
  const t = useExtracted();
  const message = useGoalLimitMessage();
  const routes = useLearnRoutes();

  if (!isPlusGoalLimit(reason)) {
    return null;
  }

  return (
    <>
      <p className="text-muted-foreground text-center text-sm text-pretty" role="alert">
        {message(reason)}
      </p>

      <LearnLink className={cn(buttonVariants({ size: "lg" }), "w-full")} href={routes.upgrade}>
        {t("Subscribe")}
      </LearnLink>

      {reason === "activeGoals" && (
        <LearnLink
          className={cn(buttonVariants({ size: "lg", variant: "outline" }), "w-full")}
          href={routes.journey}
        >
          {t("Go to your Plan")}
        </LearnLink>
      )}
    </>
  );
}
