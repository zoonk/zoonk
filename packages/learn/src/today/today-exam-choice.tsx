"use client";

import { type PlanChangeView } from "@zoonk/core/plans/view-contract";
import { safeAsync } from "@zoonk/utils/error";
import { SignpostIcon, Undo2Icon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useState, useTransition } from "react";
import {
  Suggestion,
  SuggestionAction,
  SuggestionActions,
  SuggestionContent,
  SuggestionHeader,
  SuggestionLine,
  SuggestionOpen,
  SuggestionResult,
  SuggestionSaveError,
  SuggestionSummary,
} from "../_components/suggestion";
import { PlanEffectDiff } from "../plan-diff/plan-effect-diff";
import { ExamChoiceAnswers, useExamChoiceQuestion } from "../plan/exam-choice-question";
import { useTodayChangeWords } from "./today-change-sentence";
import { useTodayScreen } from "./today-context";

type ExamChoice = NonNullable<ReturnType<typeof useTodayScreen>["today"]["examChoice"]>;

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

function ChoiceQuestion({
  choice,
  failed,
  isPending,
  onPick,
}: {
  choice: ExamChoice;
  failed: boolean;
  isPending: boolean;
  onPick: (input: { group: string; subjects: string[] }) => void;
}) {
  const t = useExtracted();
  const question = useExamChoiceQuestion()(choice);

  return (
    <>
      <SuggestionLine>
        <SuggestionSummary>{question}</SuggestionSummary>
        <SuggestionOpen>{t("Choose")}</SuggestionOpen>
      </SuggestionLine>

      <SuggestionContent>
        <SuggestionHeader>{question}</SuggestionHeader>
        <ExamChoiceAnswers choice={choice} onPick={onPick} pending={isPending} />
        {failed && <SuggestionSaveError />}
      </SuggestionContent>
    </>
  );
}

function ChoicePicked({ change, onUndone }: { change: PlanChangeView; onUndone: () => void }) {
  const t = useExtracted();
  const words = useTodayChangeWords();
  const sentence = (shown: PlanChangeView) => words(shown).title;
  const { actions } = useTodayScreen();
  const { failed, isPending, save } = useSave();

  const undo = () =>
    save(() => actions.decidePlanChange({ changeId: change.id, status: "undone" }), onUndone);

  const undoButton = change.canUndo && (
    <SuggestionAction
      action={undo}
      busy={isPending}
      icon={<Undo2Icon aria-hidden="true" />}
      variant="outline"
    >
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
        <PlanEffectDiff dateKind="exam" effect={change.effect} />
        {undoButton && <SuggestionActions>{undoButton}</SuggestionActions>}
        {failed && <SuggestionSaveError />}
      </SuggestionContent>
    </>
  );
}

export function TodayExamChoice() {
  const t = useExtracted();
  const { actions, today } = useTodayScreen();
  const [picked, setPicked] = useState<PlanChangeView | null>(null);
  const { failed, isPending, save } = useSave();
  const choice = today.examChoice;

  if (!picked && !choice) {
    return null;
  }

  const pick = (input: { group: string; subjects: string[] }) =>
    save(
      () => actions.chooseExamOption(input),
      (change) => {
        setPicked(change);
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
