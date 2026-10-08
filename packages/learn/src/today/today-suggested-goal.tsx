"use client";

import { type SuggestedGoalView } from "@zoonk/core/goals/suggestions/contract";
import { Button } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { CompassIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useState, useTransition } from "react";
import { KindTile } from "../_components/kind-tile";
import {
  NoticeCardActions,
  NoticeCardContent,
  NoticeCardDescription,
  NoticeCardLeading,
  NoticeCardTitle,
} from "../_components/notice-card";
import { SURFACE_CLASS } from "../_components/surface";
import { useTodayScreen } from "./today-context";

type SuggestedGoalAnswer = "accepted" | "dismissed";

/**
 * "Continue Physics? Build a plan in 1 minute": a course the learner was taking before goals
 * existed, offered as a goal to plan. The host records the answer and, when it's accepted, opens
 * onboarding with the course as the goal; `onAnswer` resolves to whether that worked.
 *
 * ```tsx
 * <SuggestedGoalCard onAnswer={answer} suggestion={suggestion} />
 * ```
 */
export function SuggestedGoalCard({
  onAnswer,
  suggestion,
}: {
  onAnswer: (status: SuggestedGoalAnswer) => Promise<boolean>;
  suggestion: SuggestedGoalView;
}) {
  const t = useExtracted();
  const [failed, setFailed] = useState(false);
  const [isPending, startTransition] = useTransition();

  const answer = (status: SuggestedGoalAnswer) => {
    startTransition(async () => {
      const saved = await onAnswer(status);
      setFailed(!saved);
    });
  };

  return (
    <aside
      aria-label={t("Suggested goal")}
      className={cn(SURFACE_CLASS, "flex items-start gap-3 p-4")}
    >
      <NoticeCardLeading>
        <KindTile icon={CompassIcon} kind="lesson" size="sm" />
      </NoticeCardLeading>

      <NoticeCardContent>
        <NoticeCardTitle>{t("Continue {course}?", { course: suggestion.title })}</NoticeCardTitle>
        <NoticeCardDescription>{t("Build a plan in 1 minute.")}</NoticeCardDescription>

        <NoticeCardActions>
          <Button disabled={isPending} onClick={() => answer("accepted")} size="sm">
            {t("Build my plan")}
          </Button>

          <Button
            disabled={isPending}
            onClick={() => answer("dismissed")}
            size="sm"
            variant="ghost"
          >
            {t("Not now")}
          </Button>
        </NoticeCardActions>

        {failed && (
          <p className="text-destructive mt-2 text-sm" role="alert">
            {t("We couldn't save that. Try again.")}
          </p>
        )}
      </NoticeCardContent>
    </aside>
  );
}

/** Today's suggested goal, below everything about the current goal: it never competes with it. */
export function TodaySuggestedGoal() {
  const { actions, today } = useTodayScreen();
  const suggestion = today.suggestedGoal;

  if (!suggestion) {
    return null;
  }

  return (
    <SuggestedGoalCard
      key={suggestion.id}
      onAnswer={(status) => actions.answerSuggestedGoal({ status, suggestion })}
      suggestion={suggestion}
    />
  );
}
