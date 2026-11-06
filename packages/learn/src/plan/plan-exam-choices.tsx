"use client";

import { type ExamChoiceView } from "@zoonk/core/exams/choices/contract";
import { type PlanChangeView } from "@zoonk/core/plans/view-contract";
import { RadioGroup, RadioGroupItem, RadioGroupOption } from "@zoonk/ui/components/radio-group";
import { usePressed } from "@zoonk/ui/hooks/pressed";
import { safeAsync } from "@zoonk/utils/error";
import { SignpostIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useState, useTransition } from "react";
import { ChangeSaveError } from "../_components/save-error";
import {
  Suggestion,
  SuggestionAction,
  SuggestionActions,
  SuggestionDescription,
  SuggestionHeader,
  SuggestionLine,
  SuggestionOpen,
  SuggestionResult,
  SuggestionSaveError,
  SuggestionSummary,
} from "../_components/suggestion";
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
import { useChangeSentence } from "./use-change-sentence";
import { useTappedChoice } from "./use-tapped-choice";

function useExamChoice({ onChange }: { onChange?: (change: PlanChangeView) => void } = {}) {
  const { actions, keepFocus } = usePlanScreen();
  const editor = useReportEditorChange();
  const [isPending, startTransition] = useTransition();
  const [failed, setFailed] = useState(false);

  const choose = (input: { group: string; subjects: string[] }, answer?: () => void) => {
    setFailed(false);
    keepFocus();

    startTransition(async () => {
      const { data: outcome } = await safeAsync(() => actions.chooseExamOption(input));

      // Updates after an `await` join the transition only when started in one again.
      startTransition(() => {
        setFailed(!outcome);
        answer?.();

        if (outcome?.change) {
          editor.report(outcome.change);
          onChange?.(outcome.change);
        }
      });
    });
  };

  return { choose, failed, isPending };
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
  const leftOutLine = useChoiceLeftOutLine();
  const { choose, failed, isPending } = useExamChoice();

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

      {choice.subjects.length === 0 && (
        <p className="text-muted-foreground text-sm">{leftOutLine(choice)}</p>
      )}

      {failed && <ChangeSaveError />}
    </fieldset>
  );
}

export function PlanExamChoices() {
  const { plan } = usePlanScreen();

  return plan.examChoices.map((choice) => <ExamChoice choice={choice} key={choice.group} />);
}

export function ExamChoiceSuggestion({ item }: { item: Extract<SlotItem, { kind: "choice" }> }) {
  const t = useExtracted();
  const sentence = useChangeSentence();
  const leftOutLine = useChoiceLeftOutLine();
  const { setResult } = usePlanSuggestionSlot();
  const answer = useSlotAnswer(item);
  const { choice } = item;

  const title =
    choice.take > 1
      ? t("{group}: which ones will you take?", { group: choice.group })
      : t("{group}: which one will you take?", { group: choice.group });

  const { choose, failed, isPending } = useExamChoice({
    onChange: (change) => setResult({ change, item, text: sentence(change) }),
  });

  const pressed = usePressed<string>(isPending);

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
            <SuggestionDescription>{leftOutLine(choice)}</SuggestionDescription>
            {choice.take > 1 ? (
              <ExamChoicePicks
                choice={choice}
                onSave={(subjects) => choose({ group: choice.group, subjects })}
                pending={isPending}
              />
            ) : (
              <SuggestionActions>
                {choice.options.map((option) => (
                  <SuggestionAction
                    busy={pressed.busy(option.name)}
                    disabled={isPending}
                    key={option.name}
                    onClick={() => {
                      pressed.press(option.name);
                      choose({ group: choice.group, subjects: [option.name] });
                    }}
                    variant="outline"
                  >
                    {option.shortName ?? option.name}
                  </SuggestionAction>
                ))}
              </SuggestionActions>
            )}
            {failed && <SuggestionSaveError />}
          </>
        )}
      </SlotContent>
    </Suggestion>
  );
}
