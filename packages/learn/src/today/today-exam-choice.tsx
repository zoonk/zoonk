"use client";

import { type PlanChangeView } from "@zoonk/core/plans/view-contract";
import { safeAsync } from "@zoonk/utils/error";
import { SignpostIcon } from "lucide-react";
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
  SuggestionResult,
  SuggestionSummary,
} from "../_components/suggestion";
import { useLearnAnalytics } from "../learn-context";
import { useChangeSentence } from "../plan/use-change-sentence";
import { useTodayScreen } from "./today-context";
import { ProposalEffect } from "./today-plan-change";

type ExamChoice = NonNullable<ReturnType<typeof useTodayScreen>["today"]["examChoice"]>;

/** Runs one of the notice's saves with a pending state and a failure flag. */
function useSave() {
  const [isPending, startTransition] = useTransition();
  const [failed, setFailed] = useState(false);

  function save<T>(action: () => Promise<T | null>, onSaved: (result: T) => void) {
    setFailed(false);

    startTransition(async () => {
      const { data } = await safeAsync(action);

      // Updates after an `await` join the transition only when started in one again.
      startTransition(() => {
        setFailed(!data);

        if (data) {
          onSaved(data);
        }
      });
    });
  }

  return { failed, isPending, save };
}

/** The question, one answer per option: until the learner picks, the plan studies none. */
function ChoiceQuestion({
  choice,
  failed,
  isPending,
  onPick,
}: {
  choice: ExamChoice;
  failed: boolean;
  isPending: boolean;
  onPick: (input: { group: string; subject: string }) => void;
}) {
  const t = useExtracted();
  const question = t("{group}: which one will you take?", { group: choice.group });

  return (
    <>
      <SuggestionLine>
        <SuggestionSummary>{question}</SuggestionSummary>
        <SuggestionOpen>{t("Choose")}</SuggestionOpen>
      </SuggestionLine>

      <SuggestionContent>
        <SuggestionHeader>{question}</SuggestionHeader>
        <SuggestionDescription>
          {t("Until you pick, your plan leaves {group} out.", { group: choice.group })}
        </SuggestionDescription>

        {/* Equal options, so one under the other in their order, never one as the main answer. */}
        <SuggestionActions className="flex-col items-stretch">
          {choice.options.map((option) => (
            <SuggestionAction
              disabled={isPending}
              key={option.name}
              onClick={() => onPick({ group: choice.group, subject: option.name })}
              variant="outline"
            >
              {option.shortName ?? option.name}
            </SuggestionAction>
          ))}
        </SuggestionActions>

        {failed && (
          <SuggestionError>{t("That didn't work. Try again in a moment.")}</SuggestionError>
        )}
      </SuggestionContent>
    </>
  );
}

/** What the pick did, where its question was, with Undo, which asks again. */
function ChoicePicked({ change, onUndone }: { change: PlanChangeView; onUndone: () => void }) {
  const t = useExtracted();
  const sentence = useChangeSentence();
  const { actions } = useTodayScreen();
  const { failed, isPending, save } = useSave();

  const undo = () =>
    save(() => actions.decidePlanChange({ changeId: change.id, status: "undone" }), onUndone);

  const undoButton = change.canUndo && (
    <SuggestionAction disabled={isPending} onClick={undo} variant="outline">
      {t("Undo")}
    </SuggestionAction>
  );

  return (
    <>
      <SuggestionLine>
        <SuggestionResult>{sentence(change)}</SuggestionResult>
        {undoButton}
      </SuggestionLine>

      <SuggestionContent>
        <SuggestionResult>{sentence(change)}</SuggestionResult>
        <ProposalEffect change={change} />
        {undoButton && <SuggestionActions>{undoButton}</SuggestionActions>}
        {failed && (
          <SuggestionError>{t("That didn't work. Try again in a moment.")}</SuggestionError>
        )}
      </SuggestionContent>
    </>
  );
}

/**
 * An exam choice the learner left for later ("Decide later" in onboarding), asked on Today, where
 * they study: until they pick, the plan studies none of its options (Ana, 15 days in, had no
 * foreign language, and only the plan's pages said so). The pick then says what it did in place,
 * with Undo, which asks again.
 */
export function TodayExamChoice() {
  const t = useExtracted();
  const { actions, today } = useTodayScreen();
  const analytics = useLearnAnalytics();
  const [picked, setPicked] = useState<PlanChangeView | null>(null);
  const { failed, isPending, save } = useSave();
  const choice = today.examChoice;

  if (!picked && !choice) {
    return null;
  }

  const pick = (input: { group: string; subject: string }) =>
    save(
      () => actions.chooseExamOption(input),
      (change) => {
        setPicked(change);
        analytics.track({ name: "Plan Edited", properties: { change_kind: "setExamChoice" } });
      },
    );

  return (
    <Suggestion
      answered={picked ? picked.id : false}
      data-slot="exam-choice-notice"
      label={t("Exam choice")}
      mark={<SignpostIcon />}
    >
      {picked ? (
        <ChoicePicked change={picked} onUndone={() => setPicked(null)} />
      ) : (
        choice && (
          <ChoiceQuestion choice={choice} failed={failed} isPending={isPending} onPick={pick} />
        )
      )}
    </Suggestion>
  );
}
