"use client";

import { type SuggestedGoalView } from "@zoonk/core/goals/suggestions/contract";
import { Button } from "@zoonk/ui/components/button";
import { CompassIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useState, useTransition } from "react";
import {
  Suggestion,
  SuggestionAction,
  SuggestionActions,
  SuggestionContent,
  SuggestionDescription,
  SuggestionError,
  SuggestionHeader,
  SuggestionLine,
  SuggestionOpen,
  SuggestionSummary,
} from "../_components/suggestion";
import { useTodayScreen } from "./today-context";

type SuggestedGoalAnswer = "accepted" | "dismissed";

/** Saves the answer through the host, which moves on to onboarding when it's accepted. */
function useSuggestedGoalAnswer(onAnswer: (status: SuggestedGoalAnswer) => Promise<boolean>) {
  const [failed, setFailed] = useState(false);
  const [isPending, startTransition] = useTransition();

  const answer = (status: SuggestedGoalAnswer) => {
    startTransition(async () => {
      const saved = await onAnswer(status);
      setFailed(!saved);
    });
  };

  return { answer, failed, isPending };
}

/**
 * "Continue Physics? Build a plan in 1 minute": a course the learner was taking before goals
 * existed, offered as a goal to plan. The host records the answer and, when it's accepted, opens
 * onboarding with the course as the goal; `onAnswer` resolves to whether that worked.
 *
 * ```tsx
 * <SuggestedGoalCard onAnswer={answer} suggestion={suggestion} />
 * ```
 */
function SuggestedGoalCard({
  onAnswer,
  suggestion,
}: {
  onAnswer: (status: SuggestedGoalAnswer) => Promise<boolean>;
  suggestion: SuggestedGoalView;
}) {
  const t = useExtracted();
  const { answer, failed, isPending } = useSuggestedGoalAnswer(onAnswer);
  const question = t("Continue {course}?", { course: suggestion.title });

  return (
    <Suggestion label={t("Suggested goal")} mark={<CompassIcon />}>
      <SuggestionLine>
        <SuggestionSummary>{question}</SuggestionSummary>
        <SuggestionOpen />
      </SuggestionLine>

      <SuggestionContent>
        <SuggestionHeader>{question}</SuggestionHeader>
        <SuggestionDescription>{t("Build a plan in 1 minute.")}</SuggestionDescription>

        <SuggestionActions>
          <SuggestionAction disabled={isPending} onClick={() => answer("accepted")}>
            {t("Build my plan")}
          </SuggestionAction>

          <SuggestionAction
            disabled={isPending}
            onClick={() => answer("dismissed")}
            variant="outline"
          >
            {t("Not now")}
          </SuggestionAction>
        </SuggestionActions>

        {failed && <SuggestionError>{t("We couldn't save that. Try again.")}</SuggestionError>}
      </SuggestionContent>
    </Suggestion>
  );
}
/**
 * The course from before goals as the page itself, for a learner who has no goal yet ("Welcome
 * back"): the question, what it takes, and both answers, 44px, in thumb reach.
 */
export function SuggestedGoalOffer({
  onAnswer,
  suggestion,
}: {
  onAnswer: (status: SuggestedGoalAnswer) => Promise<boolean>;
  suggestion: SuggestedGoalView;
}) {
  const t = useExtracted();
  const { answer, failed, isPending } = useSuggestedGoalAnswer(onAnswer);

  return (
    <section aria-label={t("Suggested goal")} className="flex flex-col gap-4">
      <div className="flex items-start gap-3 border-y py-3">
        <CompassIcon aria-hidden="true" className="text-muted-foreground mt-0.5 size-4 shrink-0" />
        <p className="text-sm leading-5 text-pretty">
          <span className="font-medium">
            {t("Continue {course}?", { course: suggestion.title })}
          </span>{" "}
          <span className="text-muted-foreground">{t("Build a plan in 1 minute.")}</span>
        </p>
      </div>

      <div className="flex gap-2 [&>*:first-child]:flex-1 sm:[&>*:first-child]:flex-none">
        <Button
          disabled={isPending}
          focusableWhenDisabled
          onClick={() => answer("accepted")}
          size="lg"
        >
          {t("Build my plan")}
        </Button>
        <Button
          disabled={isPending}
          focusableWhenDisabled
          onClick={() => answer("dismissed")}
          size="lg"
          variant="outline"
        >
          {t("Not now")}
        </Button>
      </div>

      {failed && (
        <p className="text-destructive-text text-sm" role="alert">
          {t("We couldn't save that. Try again.")}
        </p>
      )}
    </section>
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
