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

  if (reason !== "activeGoals") {
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
        ? t({
            description:
              "Shown on the screen for typing a new goal, before the learner types, when a free learner already follows as many goals as the free plan allows at once. Quick questions are short explanations that don't take one of those goals. “Following” a goal means it's active on the learner's plan: this counts goals followed at once, not new goals started per day or month. Pausing a goal keeps its progress. “Plus” is the name of the paid plan, not the word “more”.",
            message:
              "You're following as many goals as the free plan allows. To make room for another, pause one from the menu on your Plan. Quick questions work anytime.",
          })
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
