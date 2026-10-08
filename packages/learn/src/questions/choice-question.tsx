"use client";

import { type ChapterTestOutResult } from "@zoonk/core/learner/test-out/get";
import { type TrueFalseLabels } from "@zoonk/core/library/exams/true-false-labels";
import { LineMarker } from "@zoonk/ui/components/line-marker";
import { useNumberKeys } from "@zoonk/ui/hooks/keyboard";
import { cn } from "@zoonk/ui/lib/utils";
import { CheckIcon, XIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { ItemLine, ItemSupport } from "./item-text";
import { useTrueFalseLabels } from "./use-true-false-labels";

/** A bank question as learners see it: never which answer is right. */
export type ChoiceQuestionView = Extract<
  ChapterTestOutResult,
  { status: "ready" }
>["testOut"]["questions"][number];

export type ChoiceAnswer = { dontKnow: true } | { isTrue: boolean } | { selectedIndex: number };

/** Shown after an answer when the flow gives feedback (practice); tests give none. */
export type ChoiceFeedback = {
  correctAnswer: { isTrue: boolean } | { selectedIndex: number };
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

function getOptionResult(
  option: Option,
  feedback: ChoiceFeedback | null,
  selected: ChoiceAnswer | null,
) {
  if (!feedback) {
    return null;
  }

  if (isSame(feedback.correctAnswer, option.answer)) {
    return "right";
  }

  return isSame(selected, option.answer) ? "wrong" : null;
}

/**
 * One multiple-choice or true-or-false question, for test-outs and mistake practice. The host
 * decides what happens on an answer; with feedback, the right answer and why appear in place.
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
  onSelect: (answer: ChoiceAnswer) => void;
  question: ChoiceQuestionView;
  selected: ChoiceAnswer | null;
  /** How true-or-false questions are answered: the goal's exam's words, or true or false. */
  trueFalseLabels?: TrueFalseLabels;
}) {
  const t = useExtracted();
  const options = useOptions({ question, trueFalseLabels });
  const locked = disabled || feedback !== null;

  useNumberKeys({
    count: options.length,
    enabled: !locked,
    onPick: (index) => {
      const option = options[index];

      if (option) {
        onSelect(option.answer);
      }
    },
  });

  return (
    <div className="flex flex-col gap-4">
      <ItemSupport
        className="text-muted-foreground text-sm"
        context={question.context}
        image={question.image}
        visual={question.visual}
      />
      <h2 className="text-lg font-medium">
        <ItemLine text={question.question} />
      </h2>

      <ul className="flex flex-col gap-2">
        {options.map((option, index) => {
          const result = getOptionResult(option, feedback, selected);

          return (
            <li key={option.key}>
              <button
                aria-pressed={isSame(selected, option.answer)}
                className={cn(
                  // The number and mark sit on the label's first line when it wraps.
                  "border-border focus-visible:ring-ring/50 flex min-h-12 w-full items-start gap-3 rounded-2xl border px-4 py-3.5 text-left outline-none focus-visible:ring-[3px]",
                  "aria-pressed:border-foreground aria-pressed:bg-muted",
                  result === "right" && "border-success bg-success/10",
                  result === "wrong" && "border-destructive bg-destructive/10",
                )}
                disabled={locked}
                onClick={() => onSelect(option.answer)}
                type="button"
              >
                <LineMarker aria-hidden="true" className="text-sm">
                  <span className="bg-muted flex size-6 items-center justify-center rounded-md text-xs font-semibold">
                    {index + 1}
                  </span>
                </LineMarker>
                <span className="flex-1 text-sm">{option.label}</span>
                {result && (
                  <LineMarker className="text-sm">
                    {result === "right" && (
                      <CheckIcon aria-label={t("Right answer")} className="text-success size-4" />
                    )}
                    {result === "wrong" && (
                      <XIcon aria-label={t("Your answer")} className="text-destructive size-4" />
                    )}
                  </LineMarker>
                )}
              </button>
            </li>
          );
        })}
      </ul>

      {feedback && (
        <div aria-live="polite" className="bg-muted rounded-2xl p-4 text-sm" role="status">
          <p className="font-medium">{feedback.isCorrect ? t("Right!") : t("Not quite.")}</p>
          {feedback.explanation && (
            <p className="text-muted-foreground mt-1">{feedback.explanation}</p>
          )}
        </div>
      )}
    </div>
  );
}
