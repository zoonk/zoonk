"use client";

import { buttonVariants } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { PlusNotice } from "../../_components/plus-lock";
import { useLearnRoutes } from "../../learn-context";
import { LearnLink } from "../../learn-link";
import { useGoalLimitMessage } from "../goal-errors";
import { type GoalLimitReason } from "../onboarding-actions";

export function isPlusGoalLimit(reason: GoalLimitReason): boolean {
  return reason === "activeGoals" || reason === "monthlyGoals";
}

export function GoalLimitNotice({ reason }: { reason: GoalLimitReason }) {
  const t = useExtracted();
  const routes = useLearnRoutes();

  if (!isPlusGoalLimit(reason)) {
    return null;
  }

  if (reason !== "activeGoals") {
    return (
      <PlusNotice title={t("No more new goals this month")}>
        {t("More next month, or now with Plus.")}
      </PlusNotice>
    );
  }

  return (
    <PlusNotice
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
      {t("Pause one from your Plan's menu to start another. Quick questions still work.")}
    </PlusNotice>
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
        {t("See Plus")}
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
