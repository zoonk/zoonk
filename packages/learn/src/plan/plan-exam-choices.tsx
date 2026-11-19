"use client";

import { type ExamChoiceView } from "@zoonk/core/exams/choices/contract";
import { type PlanChangeView } from "@zoonk/core/plans/view-contract";
import { NativeSelect, NativeSelectOption } from "@zoonk/ui/components/native-select";
import { safeAsync } from "@zoonk/utils/error";
import { SignpostIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useId, useTransition } from "react";
import { useChangeSaveFailed } from "../_components/save-error";
import {
  Suggestion,
  SuggestionActions,
  SuggestionHeader,
  SuggestionLine,
  SuggestionOpen,
  SuggestionResult,
  SuggestionSummary,
} from "../_components/suggestion";
import { useStillMounted } from "../_utils/use-still-mounted";
import { ExamChoicePicks } from "./exam-choice-picks";
import { ExamChoiceAnswers, useExamChoiceQuestion } from "./exam-choice-question";
import { useSharedRequest } from "./layout-shared";
import { usePlanScreen } from "./plan-context";
import { useReportEditorChange } from "./plan-editor-change-context";
import {
  SlotContent,
  type SlotItem,
  SlotUndo,
  usePlanSuggestionSlot,
  useSlotAnswer,
} from "./plan-suggestion-context";
import { usePlanChangeSentence } from "./use-change-sentence";
import { useTappedChoice } from "./use-tapped-choice";

function useExamChoice({ onChange }: { onChange?: (change: PlanChangeView) => void } = {}) {
  const { actions, keepFocus } = usePlanScreen();
  const editor = useReportEditorChange();
  const [isPending, startTransition] = useTransition();
  const saveFailed = useChangeSaveFailed();
  const isMounted = useStillMounted();
  const request = useSharedRequest("choose", isPending);

  const choose = (input: { group: string; subjects: string[] }, answer?: () => void) => {
    keepFocus();

    startTransition(async () => {
      request.start();
      const { data: outcome } = await safeAsync(() => actions.chooseExamOption(input));

      // Updates after an `await` join the transition only when started in one again.
      startTransition(() => {
        if (!outcome) {
          saveFailed();
        }

        if (outcome?.change) {
          editor.report(outcome.change);
        }

        if (isMounted()) {
          answer?.();

          if (outcome?.change) {
            onChange?.(outcome.change);
          }
        }
      });
    });
  };

  return { choose, isPending: request.busy };
}

function OneOptionChoice({
  choice,
  choose,
  isPending,
  labelId,
}: {
  choice: ExamChoiceView;
  choose: ReturnType<typeof useExamChoice>["choose"];
  isPending: boolean;
  labelId: string;
}) {
  const t = useExtracted();
  const [saved = ""] = choice.subjects;
  const tapped = useTappedChoice(saved);

  return (
    <NativeSelect
      aria-labelledby={labelId}
      disabled={isPending}
      focusableWhenDisabled
      onChange={(event) => {
        const { value } = event.target;

        if (value !== saved) {
          choose({ group: choice.group, subjects: [value] }, tapped.pick(value));
        }
      }}
      value={tapped.shown}
    >
      {!tapped.shown && (
        <NativeSelectOption disabled value="">
          {t("Not set")}
        </NativeSelectOption>
      )}

      {choice.options.map((option) => (
        <NativeSelectOption key={option.name} value={option.name}>
          {option.shortName ?? option.name}
        </NativeSelectOption>
      ))}
    </NativeSelect>
  );
}

function ExamChoice({ choice }: { choice: ExamChoiceView }) {
  const labelId = useId();
  const { choose, isPending } = useExamChoice();

  return (
    <section aria-labelledby={labelId} className="flex flex-col gap-2">
      <h3 className="text-sm font-medium" id={labelId}>
        {choice.group}
      </h3>

      {choice.take > 1 ? (
        <ExamChoicePicks
          choice={choice}
          onSave={(subjects) => choose({ group: choice.group, subjects })}
          pending={isPending}
        />
      ) : (
        <OneOptionChoice choice={choice} choose={choose} isPending={isPending} labelId={labelId} />
      )}
    </section>
  );
}

export function PlanExamChoices() {
  const { plan } = usePlanScreen();

  return plan.examChoices.map((choice) => <ExamChoice choice={choice} key={choice.group} />);
}

export function ExamChoiceSuggestion({ item }: { item: Extract<SlotItem, { kind: "choice" }> }) {
  const t = useExtracted();
  const sentence = usePlanChangeSentence();
  const question = useExamChoiceQuestion();
  const { setResult } = usePlanSuggestionSlot();
  const answer = useSlotAnswer(item);
  const { choice } = item;
  const title = question(choice);

  const { choose, isPending } = useExamChoice({
    onChange: (change) => setResult({ change, item, text: sentence(change) }),
  });

  const undo = answer && <SlotUndo item={item} />;

  return (
    <Suggestion answered={answer !== null} label={title} mark={<SignpostIcon />}>
      <SuggestionLine className="**:data-[slot=button]:min-h-11">
        {answer ? (
          <>
            <SuggestionResult>{answer.text}</SuggestionResult>
            {undo}
          </>
        ) : (
          <>
            <SuggestionSummary>{title}</SuggestionSummary>
            <SuggestionOpen>{t("Choose")}</SuggestionOpen>
          </>
        )}
      </SuggestionLine>

      <SlotContent>
        <SuggestionHeader>{title}</SuggestionHeader>

        {answer ? (
          <>
            <SuggestionResult>{answer.text}</SuggestionResult>
            <SuggestionActions>{undo}</SuggestionActions>
          </>
        ) : (
          <ExamChoiceAnswers choice={choice} onPick={choose} pending={isPending} />
        )}
      </SlotContent>
    </Suggestion>
  );
}
