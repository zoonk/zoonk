"use client";

import { type SuggestedGoalView } from "@zoonk/core/goals/suggestions/contract";
import { Button } from "@zoonk/ui/components/button";
import { CompassIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useState, useTransition } from "react";
import { ChangeSaveError } from "../_components/save-error";
import {
  Suggestion,
  SuggestionAction,
  SuggestionActions,
  SuggestionContent,
  SuggestionDescription,
  SuggestionHeader,
  SuggestionLine,
  SuggestionOpen,
  SuggestionSaveError,
  SuggestionSummary,
} from "../_components/suggestion";
import { useTodayScreen } from "./today-context";

type SuggestedGoalAnswer = "accepted" | "dismissed";

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

/** `onAnswer` resolves to whether it worked. */
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

        {failed && <SuggestionSaveError />}
      </SuggestionContent>
    </Suggestion>
  );
}
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

      {failed && <ChangeSaveError />}
    </section>
  );
}

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
