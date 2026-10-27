"use client";

import { type ChapterTestOutResult } from "@zoonk/core/learner/test-out/get";
import { type TrueFalseLabels } from "@zoonk/core/library/exams/true-false-labels";
import { useNumberKeys } from "@zoonk/ui/hooks/keyboard";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { useState } from "react";
import { AnswerOption, AnswerOptionGroup } from "../_components/answer-option";
import { FeedbackExplanation, FeedbackPanel, FeedbackVerdict } from "../_components/feedback-panel";
import { ItemLine, ItemStem, ItemSupport, ItemText, QUESTION_TEXT_CLASS } from "./item-text";
import { PickRule, isCompletePick, isMultiPick, togglePick } from "./pick-rule";
import { useTrueFalseLabels } from "./use-true-false-labels";

/** The question's title, which a run of questions focuses as each new one shows. */
export const CHOICE_QUESTION_TITLE_SLOT = "choice-question-title";

/** A bank question as learners see it: never which answer is right. */
export type ChoiceQuestionView = Extract<
  ChapterTestOutResult,
  { status: "ready" }
>["testOut"]["questions"][number];

export type ChoiceAnswer =
  | { dontKnow: true }
  | { isTrue: boolean }
  | { selectedIndex: number }
  | { selectedIndexes: number[] };

/** Shown after an answer when the flow gives feedback (practice); tests give none. */
export type ChoiceFeedback = {
  correctAnswer: { isTrue: boolean } | { selectedIndex: number } | { selectedIndexes: number[] };
  explanation: string | null;
  isCorrect: boolean;
};

type Option = { answer: ChoiceAnswer; key: string; label: string };

function useOptions({
  question,
  trueFalseLabels,
}: {
  question: ChoiceQuestionView;
  trueFalseLabels: TrueFalseLabels;
}): Option[] {
  const { answerLabel } = useTrueFalseLabels(trueFalseLabels);

  if (question.format === "trueFalse") {
    return [
      { answer: { isTrue: true }, key: "true", label: answerLabel(true) },
      { answer: { isTrue: false }, key: "false", label: answerLabel(false) },
    ];
  }

  return (question.options ?? []).map((label, index) => ({
    answer: { selectedIndex: index },
    key: String(index),
    label,
  }));
}

function isSame(a: ChoiceAnswer | null, b: ChoiceAnswer): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** Whether an answer picks the option at `index`, as its one pick or one of several. */
function picksOption({ answer, index }: { answer: ChoiceAnswer | null; index: number }) {
  if (answer && "selectedIndexes" in answer) {
    return answer.selectedIndexes.includes(index);
  }

  return answer !== null && "selectedIndex" in answer && answer.selectedIndex === index;
}

function getOptionResult({
  feedback,
  index,
  option,
  picked,
}: {
  feedback: ChoiceFeedback | null;
  index: number;
  option: Option;
  picked: boolean;
}) {
  if (!feedback) {
    return null;
  }

  const right =
    isSame(feedback.correctAnswer, option.answer) ||
    picksOption({ answer: feedback.correctAnswer, index });

  if (right) {
    return "right";
  }

  return picked ? "wrong" : null;
}

/**
 * The options picked so far for a question that asks for several, kept per question and shown
 * whether or not they're enough to send yet. A sent answer's picks show again after a reload.
 */
function usePicks({
  question,
  selected,
}: {
  question: ChoiceQuestionView;
  selected: ChoiceAnswer | null;
}) {
  const initial = selected && "selectedIndexes" in selected ? selected.selectedIndexes : [];
  const [state, setState] = useState({ itemId: question.itemId, picks: initial });

  const current =
    state.itemId === question.itemId ? state : { itemId: question.itemId, picks: initial };

  if (state.itemId !== question.itemId) {
    setState(current);
  }

  return [
    current.picks,
    (picks: number[]) => setState({ itemId: question.itemId, picks }),
  ] as const;
}

/**
 * The grade after an answer, on the panel every question's feedback uses: the verdict (only it
 * carries color) and why.
 */
function ChoiceGrade({ feedback }: { feedback: ChoiceFeedback }) {
  const t = useExtracted();

  return (
    <FeedbackPanel aria-live="polite" role="status">
      <FeedbackVerdict tone={feedback.isCorrect ? "right" : "wrong"}>
        {feedback.isCorrect ? t("Correct!") : t("Not quite")}
      </FeedbackVerdict>
      {feedback.explanation && (
        <FeedbackExplanation>
          <ItemText text={feedback.explanation} />
        </FeedbackExplanation>
      )}
    </FeedbackPanel>
  );
}

/**
 * One multiple-choice or true-or-false question, for test-outs and mistake practice. The host
 * decides what happens on an answer; with feedback, the right answer and why appear in place. A
 * question that asks for several options
 * (`select`) toggles them, and the host gets an answer only once as many as it asks are picked
 * (null before).
 */
export function ChoiceQuestion({
  disabled = false,
  feedback = null,
  onSelect,
  question,
  selected,
  trueFalseLabels = "trueFalse",
}: {
  disabled?: boolean;
  feedback?: ChoiceFeedback | null;
  onSelect: (answer: ChoiceAnswer | null) => void;
  question: ChoiceQuestionView;
  selected: ChoiceAnswer | null;
  /** How true-or-false questions are answered: the goal's exam's words, or true or false. */
  trueFalseLabels?: TrueFalseLabels;
}) {
  const options = useOptions({ question, trueFalseLabels });
  const locked = disabled || feedback !== null;
  const select = question.format === "multipleChoice" ? question.select : null;
  const [picks, setPicks] = usePicks({ question, selected });

  const isPicked = (option: Option, index: number) =>
    isMultiPick(select) ? picks.includes(index) : isSame(selected, option.answer);

  const choose = (index: number) => {
    const option = options[index];

    if (!option) {
      return;
    }

    if (!isMultiPick(select)) {
      onSelect(option.answer);
      return;
    }

    const next = togglePick(picks, index);
    setPicks(next);
    onSelect(isCompletePick({ picks: next, select }) ? { selectedIndexes: next } : null);
  };

  useNumberKeys({ count: options.length, enabled: !locked, onPick: choose });

  return (
    <div className="flex flex-col gap-4">
      <ItemSupport context={question.context} image={question.image} visual={question.visual} />
      <div
        className={cn(QUESTION_TEXT_CLASS, "outline-none")}
        data-slot={CHOICE_QUESTION_TITLE_SLOT}
        tabIndex={-1}
      >
        <ItemStem text={question.question} heading="h2" />
      </div>

      {isMultiPick(select) && <PickRule select={select} />}

      {/* Picked like an exam's answer sheet: Enter on a picked answer sends it, as a radio does. */}
      <AnswerOptionGroup role={isMultiPick(select) ? "group" : "radiogroup"}>
        {options.map((option, index) => {
          const picked = isPicked(option, index);
          const result = getOptionResult({ feedback, index, option, picked });

          return (
            <AnswerOption
              aria-keyshortcuts={String(index + 1)}
              disabled={locked}
              key={option.key}
              marker={index + 1}
              onClick={() => choose(index)}
              picked={picked}
              result={result}
              role={isMultiPick(select) ? "checkbox" : "radio"}
            >
              <ItemLine text={option.label} />
            </AnswerOption>
          );
        })}
      </AnswerOptionGroup>

      {feedback && <ChoiceGrade feedback={feedback} />}
    </div>
  );
}
