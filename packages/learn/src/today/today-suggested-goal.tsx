"use client";

import { type SuggestedGoalView } from "@zoonk/core/goals/suggestions/contract";
import { Button } from "@zoonk/ui/components/button";
import { LineMarker } from "@zoonk/ui/components/line-marker";
import { CompassIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useState, useTransition } from "react";
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
      className="bg-muted/60 in-data-[mode=fun]:fun-glass flex flex-col gap-3 rounded-2xl p-4"
    >
      <div className="flex items-start gap-3">
        <LineMarker>
          <CompassIcon aria-hidden="true" className="text-muted-foreground size-4.5" />
        </LineMarker>

        <div className="flex flex-col gap-0.5">
          <p className="font-medium">{t("Continue {course}?", { course: suggestion.title })}</p>
          <p className="text-muted-foreground text-sm">{t("Build a plan in 1 minute.")}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button disabled={isPending} onClick={() => answer("accepted")} size="sm">
          {t("Build my plan")}
        </Button>

        <Button disabled={isPending} onClick={() => answer("dismissed")} size="sm" variant="ghost">
          {t("Not now")}
        </Button>
      </div>

      {failed && (
        <p className="text-destructive text-sm" role="alert">
          {t("We couldn't save that. Try again.")}
        </p>
      )}
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
