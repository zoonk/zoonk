"use client";

import { type ExamChoiceView } from "@zoonk/core/exams/choices/contract";
import { type PlanChangeView } from "@zoonk/core/plans/view-contract";
import { RadioGroup, RadioGroupItem, RadioGroupOption } from "@zoonk/ui/components/radio-group";
import { safeAsync } from "@zoonk/utils/error";
import { SignpostIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useTransition } from "react";
import { useChangeSaveFailed } from "../_components/save-error";
import {
  Suggestion,
  SuggestionAction,
  SuggestionActions,
  SuggestionDescription,
  SuggestionHeader,
  SuggestionLine,
  SuggestionOpen,
  SuggestionResult,
  SuggestionSummary,
} from "../_components/suggestion";
import { SuggestionChoices } from "../_components/suggestion-choices";
import { useChoiceLeftOutLine } from "../_utils/use-choice-left-out";
import { ExamChoicePicks } from "./exam-choice-picks";
import { usePlanScreen } from "./plan-context";
import { useReportEditorChange } from "./plan-editor-change-context";
import { PLAN_OPTION_CLASS } from "./plan-option-styles";
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

  const choose = (input: { group: string; subjects: string[] }, answer?: () => void) => {
    keepFocus();

    startTransition(async () => {
      const { data: outcome } = await safeAsync(() => actions.chooseExamOption(input));

      // Updates after an `await` join the transition only when started in one again.
      startTransition(() => {
        if (!outcome) {
          saveFailed();
        }

        answer?.();

        if (outcome?.change) {
          editor.report(outcome.change);
          onChange?.(outcome.change);
        }
      });
    });
  };

  return { choose, isPending };
}

function OneOptionChoice({
  choice,
  choose,
  isPending,
}: {
  choice: ExamChoiceView;
  choose: ReturnType<typeof useExamChoice>["choose"];
  isPending: boolean;
}) {
  const [saved = ""] = choice.subjects;
  const tapped = useTappedChoice(saved);

  return (
    <RadioGroup
      className="flex flex-wrap gap-2"
      disabled={isPending}
      onValueChange={(value) => {
        if (typeof value === "string" && value !== saved) {
          choose({ group: choice.group, subjects: [value] }, tapped.pick(value));
        }
      }}
      value={tapped.shown}
    >
      {choice.options.map((option) => (
        <RadioGroupOption className={PLAN_OPTION_CLASS} key={option.name}>
          <RadioGroupItem value={option.name} />
          {option.shortName ?? option.name}
        </RadioGroupOption>
      ))}
    </RadioGroup>
  );
}

function ExamChoice({ choice }: { choice: ExamChoiceView }) {
  const { choose, isPending } = useExamChoice();

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-sm font-medium">{choice.group}</legend>

      {choice.take > 1 ? (
        <ExamChoicePicks
          choice={choice}
          onSave={(subjects) => choose({ group: choice.group, subjects })}
          pending={isPending}
        />
      ) : (
        <OneOptionChoice choice={choice} choose={choose} isPending={isPending} />
      )}
    </fieldset>
  );
}

export function PlanExamChoices() {
  const { plan } = usePlanScreen();

  return plan.examChoices.map((choice) => <ExamChoice choice={choice} key={choice.group} />);
}

export function ExamChoiceSuggestion({ item }: { item: Extract<SlotItem, { kind: "choice" }> }) {
  const t = useExtracted();
  const sentence = usePlanChangeSentence();
  const leftOutLine = useChoiceLeftOutLine();
  const { setResult } = usePlanSuggestionSlot();
  const answer = useSlotAnswer(item);
  const { choice } = item;

  const title =
    choice.take > 1
      ? t("{group}: which ones will you take?", { group: choice.group })
      : t("{group}: which one will you take?", { group: choice.group });

  const { choose, isPending } = useExamChoice({
    onChange: (change) => setResult({ change, item, text: sentence(change) }),
  });

  const undo = answer && <SlotUndo item={item} />;

  return (
    <Suggestion answered={answer !== null} label={title} mark={<SignpostIcon />}>
      <SuggestionLine>
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
          <>
            <SuggestionDescription>{leftOutLine}</SuggestionDescription>

            {choice.take > 1 ? (
              <ExamChoicePicks
                choice={choice}
                onSave={(subjects) => choose({ group: choice.group, subjects })}
                pending={isPending}
              />
            ) : (
              <SuggestionChoices>
                {choice.options.map((option) => (
                  <SuggestionAction
                    action={() => choose({ group: choice.group, subjects: [option.name] })}
                    disabled={isPending}
                    key={option.name}
                    variant="outline"
                  >
                    {option.shortName ?? option.name}
                  </SuggestionAction>
                ))}
              </SuggestionChoices>
            )}
          </>
        )}
      </SlotContent>
    </Suggestion>
  );
}
