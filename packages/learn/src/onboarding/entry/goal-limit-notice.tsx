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
  return reason === "oneActiveGoal" || reason === "monthlyGoals";
}

export function GoalLimitNotice({
  reason,
  upFront = false,
}: {
  reason: GoalLimitReason;
  upFront?: boolean;
}) {
  const t = useExtracted();
  const message = useGoalLimitMessage();
  const routes = useLearnRoutes();

  if (!isPlusGoalLimit(reason)) {
    return null;
  }

  if (reason !== "oneActiveGoal") {
    return <PlusNotice>{message(reason)}</PlusNotice>;
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
      title={t("More goals at once with Plus")}
    >
      {upFront
        ? t(
            "The free plan follows one goal at a time. To start another, pause your current goal from the menu on your Plan. Quick questions work anytime.",
          )
        : message(reason)}
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

      {reason === "oneActiveGoal" && (
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
