"use client";

import { buttonVariants } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { PlusNotice } from "../../_components/plus-lock";
import { useLearnRoutes } from "../../learn-context";
import { LearnLink } from "../../learn-link";
import { useGoalLimitMessage } from "../goal-errors";
import { type GoalLimitReason } from "../onboarding-actions";

/** The goal limits Plus lifts: the free plan's one goal at a time, and its goals for the month. */
export function isPlusGoalLimit(reason: GoalLimitReason): boolean {
  return reason === "oneActiveGoal" || reason === "monthlyGoals";
}

/**
 * A goal limit Plus lifts, as the one Plus notice: up front where goals start (`upFront`, before
 * anything is typed, while quick questions still work), and the same notice when a goal is
 * refused, staying until the learner moves on. The free plan's one goal offers the free way under
 * Plus too, as the course wall does: their Plan, whose menu pauses the goal they're on. Nothing for
 * a limit Plus doesn't lift.
 */
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

/**
 * A goal Plus would let start, in place of the buttons that would only be refused again, as a
 * course's start page says it: why, "See Plus" first and, for the free plan's one goal, the free
 * way under it (their Plan, whose menu pauses the goal they're on). Nothing for a limit Plus
 * doesn't lift.
 */
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
