"use client";

import { type SuggestedGoalView } from "@zoonk/core/goals/suggestions/contract";
import { BottomBar, BottomBarActions } from "@zoonk/ui/components/bottom-bar";
import { Button } from "@zoonk/ui/components/button";
import { safeAsync } from "@zoonk/utils/error";
import { CompassIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useState, useTransition } from "react";
import { EnterButton } from "../_components/enter-button";
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
import { TodayStatusClause, TodayStatusLine, TodayStatusSentence } from "./today-status-line";

type SuggestedGoalAnswer = "accepted" | "dismissed";

function useSuggestedGoalAnswer(onAnswer: (status: SuggestedGoalAnswer) => Promise<boolean>) {
  const [failed, setFailed] = useState(false);
  const [isPending, startTransition] = useTransition();

  const answer = (status: SuggestedGoalAnswer) => {
    startTransition(async () => {
      const { data: saved } = await safeAsync(() => onAnswer(status));
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

        <SuggestionActions
          main={
            <SuggestionAction action={() => answer("accepted")} disabled={isPending}>
              {t("Start")}
            </SuggestionAction>
          }
        >
          <SuggestionAction
            action={() => answer("dismissed")}
            disabled={isPending}
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
/** The page for a learner without a goal: its last child, so its two answers sit in the page's bar. */
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
    <>
      <section aria-label={t("Suggested goal")}>
        <TodayStatusLine icon={<CompassIcon />}>
          <TodayStatusSentence>
            {t("Continue {course}?", { course: suggestion.title })}
          </TodayStatusSentence>
          <TodayStatusClause>{t("Build a plan in 1 minute.")}</TodayStatusClause>
        </TodayStatusLine>
      </section>

      <BottomBar note={failed && <ChangeSaveError />}>
        <BottomBarActions>
          <Button
            disabled={isPending}
            focusableWhenDisabled
            onClick={() => answer("dismissed")}
            size="xl"
            variant="outline"
          >
            {t("Not now")}
          </Button>
          <EnterButton busy={isPending} onClick={() => answer("accepted")}>
            {t("Start")}
          </EnterButton>
        </BottomBarActions>
      </BottomBar>
    </>
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
