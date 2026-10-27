"use client";

import { type ExamChoiceView } from "@zoonk/core/exams/choices/contract";
import { type PlanChangeView } from "@zoonk/core/plans/view-contract";
import { RadioGroup, RadioGroupItem, RadioGroupOption } from "@zoonk/ui/components/radio-group";
import { safeAsync } from "@zoonk/utils/error";
import { SignpostIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useState, useTransition } from "react";
import {
  Suggestion,
  SuggestionAction,
  SuggestionActions,
  SuggestionDescription,
  SuggestionError,
  SuggestionHeader,
  SuggestionLine,
  SuggestionOpen,
  SuggestionResult,
  SuggestionSummary,
} from "../_components/suggestion";
import { useLearnAnalytics } from "../learn-context";
import { usePlanScreen } from "./plan-context";
import { useReportEditorChange } from "./plan-editor-change-context";
import { PlanFailedMessage } from "./plan-failed-message";
import { PLAN_OPTION_CLASS } from "./plan-option-styles";
import {
  SlotContent,
  type SlotItem,
  SlotUndo,
  usePlanSuggestionSlot,
  useSlotAnswer,
  useSlotAnswered,
} from "./plan-suggestion-context";
import { useChangeSentence } from "./use-change-sentence";
import { useTappedChoice } from "./use-tapped-choice";

/**
 * Saves a pick with a pending state and a failure flag, like the plan's other controls. The change
 * it made becomes the editor's latest, so the editor says which option the plan now studies, with
 * Undo (see `PlanEditorChange`); `onChange` hears it too, for a card that says it in place.
 * `answer` runs once the pick answers, with the re-planned page, as `usePlanChange`'s does.
 */
function useExamChoice({ onChange }: { onChange?: (change: PlanChangeView) => void } = {}) {
  const { actions, keepFocus } = usePlanScreen();
  const editor = useReportEditorChange();
  const analytics = useLearnAnalytics();
  const [isPending, startTransition] = useTransition();
  const [failed, setFailed] = useState(false);

  const choose = (input: { group: string; subject: string }, answer?: () => void) => {
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

      if (outcome) {
        analytics.track({ name: "Plan Edited", properties: { change_kind: "setExamChoice" } });
      }
    });
  };

  return { choose, failed, isPending };
}

/**
 * One of the exam's choices: its options, one tap each, and what an unpicked choice means. The
 * tapped option shows picked while its change saves (see `useTappedChoice`).
 */
function ExamChoice({ choice }: { choice: ExamChoiceView }) {
  const t = useExtracted();
  const { choose, failed, isPending } = useExamChoice();
  const tapped = useTappedChoice(choice.subject ?? "");

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-sm font-medium">{choice.group}</legend>

      <RadioGroup
        className="flex flex-wrap gap-2"
        disabled={isPending}
        onValueChange={(value) => {
          if (typeof value === "string" && value !== choice.subject) {
            choose({ group: choice.group, subject: value }, tapped.pick(value));
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

      {!choice.subject && (
        <p className="text-muted-foreground text-sm">
          {t("Pick the one you'll take. Until you do, your plan leaves {group} out.", {
            group: choice.group,
          })}
        </p>
      )}

      {failed && <PlanFailedMessage />}
    </fieldset>
  );
}

/**
 * The exam's choices in "Adjust your plan" (ENEM's foreign language: English or Spanish): the
 * plan, practice and mocks study only the option picked, and changing it re-plans from today.
 */
export function PlanExamChoices() {
  const { plan } = usePlanScreen();

  return plan.examChoices.map((choice) => <ExamChoice choice={choice} key={choice.group} />);
}

/**
 * One of the exam's choices the learner hasn't picked yet, in the Plan's slot until they do, since
 * the plan studies none of a choice's options before: one tap per option. The pick then says what
 * it did in its place, with Undo while it's the plan's latest change.
 */
export function ExamChoiceSuggestion({ item }: { item: Extract<SlotItem, { kind: "choice" }> }) {
  const t = useExtracted();
  const sentence = useChangeSentence();
  const { setResult } = usePlanSuggestionSlot();
  const answer = useSlotAnswer(item);
  const answered = useSlotAnswered(item);
  const { choice } = item;
  const title = t("{group}: which one will you take?", { group: choice.group });

  const { choose, failed, isPending } = useExamChoice({
    onChange: (change) => setResult({ change, item, text: sentence(change) }),
  });

  const undo = answer && <SlotUndo item={item} />;

  return (
    <Suggestion answered={answered} label={title} mark={<SignpostIcon />}>
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
            <SuggestionDescription>
              {t("Until you pick, your plan leaves {group} out.", { group: choice.group })}
            </SuggestionDescription>
            <SuggestionActions>
              {choice.options.map((option) => (
                <SuggestionAction
                  disabled={isPending}
                  key={option.name}
                  onClick={() => choose({ group: choice.group, subject: option.name })}
                  variant="outline"
                >
                  {option.shortName ?? option.name}
                </SuggestionAction>
              ))}
            </SuggestionActions>
            {failed && (
              <SuggestionError>{t("That didn't work. Try again in a moment.")}</SuggestionError>
            )}
          </>
        )}
      </SlotContent>
    </Suggestion>
  );
}
