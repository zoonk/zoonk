"use client";

import { type ExamChoiceView } from "@zoonk/core/exams/choices/contract";
import { useExtracted } from "next-intl";
import { SuggestionAction, SuggestionDescription } from "../_components/suggestion";
import { SuggestionChoices } from "../_components/suggestion-choices";
import { useChoiceLeftOutLine } from "../_utils/use-choice-left-out";
import { ExamChoicePicks } from "./exam-choice-picks";

/** The question an exam choice asks, on the Plan and on Today alike. */
export function useExamChoiceQuestion() {
  const t = useExtracted();

  return (choice: ExamChoiceView): string =>
    choice.take > 1
      ? t("{group}: which ones will you take?", { group: choice.group })
      : t("{group}: which one will you take?", { group: choice.group });
}

/** What leaves the plan, then a button per option, or a pick when the exam takes several. */
export function ExamChoiceAnswers({
  choice,
  onPick,
  pending,
}: {
  choice: ExamChoiceView;
  onPick: (input: { group: string; subjects: string[] }) => void;
  pending: boolean;
}) {
  const leftOutLine = useChoiceLeftOutLine();

  return (
    <>
      <SuggestionDescription>{leftOutLine}</SuggestionDescription>

      {choice.take > 1 ? (
        <ExamChoicePicks
          choice={choice}
          onSave={(subjects) => onPick({ group: choice.group, subjects })}
          pending={pending}
        />
      ) : (
        <SuggestionChoices>
          {choice.options.map((option) => (
            <SuggestionAction
              action={() => onPick({ group: choice.group, subjects: [option.name] })}
              disabled={pending}
              key={option.name}
              variant="outline"
            >
              {option.shortName ?? option.name}
            </SuggestionAction>
          ))}
        </SuggestionChoices>
      )}
    </>
  );
}
