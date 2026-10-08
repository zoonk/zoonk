"use client";

import { type MistakePatternView } from "@zoonk/core/language/patterns/contract";
import { useExtracted, useFormatter } from "next-intl";
import {
  type ChoiceFeedback,
  ChoiceQuestion,
  type ChoiceQuestionView,
} from "../../questions/choice-question";
import { type PatternPracticeResult } from "./use-pattern-drill";

type DrillQuestion = MistakePatternView["drill"][number];

/**
 * A drill sentence as the shared choice question draws it, with its options in order. The drill
 * isn't a bank item: the question reads only the format, options and text, so the ids just name
 * the sentence.
 */
function toChoiceQuestion({
  index,
  question,
}: {
  index: number;
  question: DrillQuestion;
}): ChoiceQuestionView {
  return {
    context: null,
    format: "multipleChoice",
    image: null,
    itemId: `pattern-drill-${index}`,
    options: question.options,
    question: question.sentence,
    skillId: "",
    visual: null,
  };
}

function toFeedback({
  answer,
  question,
}: {
  answer: string | null;
  question: DrillQuestion;
}): ChoiceFeedback | null {
  if (answer === null) {
    return null;
  }

  return {
    correctAnswer: { selectedIndex: question.options.indexOf(question.answer) },
    explanation: question.feedback,
    isCorrect: answer.trim() === question.answer.trim(),
  };
}

/**
 * One fill-in-the-blank sentence: tap an option or press its number, and the right answer and why
 * show at once. Nothing is saved until the last one.
 */
export function PatternDrillQuestion({
  answer,
  index,
  onPick,
  question,
}: {
  answer: string | null;
  index: number;
  onPick: (option: string) => void;
  question: DrillQuestion;
}) {
  const selectedIndex = answer === null ? -1 : question.options.indexOf(answer);

  return (
    <ChoiceQuestion
      feedback={toFeedback({ answer, question })}
      onSelect={(choice) => {
        const option = "selectedIndex" in choice ? question.options[choice.selectedIndex] : null;

        if (option !== undefined && option !== null) {
          onPick(option);
        }
      }}
      question={toChoiceQuestion({ index, question })}
      selected={selectedIndex === -1 ? null : { selectedIndex }}
    />
  );
}

/** The drill's result: right answers of the total and the Brain Power it paid. */
export function PatternDrillResult({ result }: { result: PatternPracticeResult }) {
  const t = useExtracted();
  const format = useFormatter();
  const allRight = result.correct === result.total;

  return (
    <div
      aria-live="polite"
      className="flex flex-col items-center gap-3 py-8 text-center"
      role="status"
    >
      <h1 className="text-3xl font-bold tracking-tight tabular-nums">
        {t("{correct, number} of {total, number} right", {
          correct: result.correct,
          total: result.total,
        })}
      </h1>
      {result.brainPower > 0 && (
        <p className="text-score font-semibold tabular-nums">
          {t("+{points} Brain Power", { points: format.number(result.brainPower) })}
        </p>
      )}
      <p className="text-muted-foreground max-w-sm">
        {allRight
          ? t("You've got this rule.")
          : t("Knowing the rule is the first step. It gets easier each time you use it.")}
      </p>
    </div>
  );
}
