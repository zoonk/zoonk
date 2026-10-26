"use client";

import { type MistakePatternView } from "@zoonk/core/language/patterns/contract";
import { useExtracted } from "next-intl";
import { BrainPowerReadout, ReadoutNumber } from "../../_components/moment-readouts";
import { type LearnBuddy } from "../../buddies/use-buddy-name";
import {
  type ChoiceFeedback,
  ChoiceQuestion,
  type ChoiceQuestionView,
} from "../../questions/choice-question";
import { DayMoment } from "../../session/day-moment";
import { MOMENT_TITLE_PROPS } from "../../session/moment-ceremony";
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
    select: 1,
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
 * One fill-in-the-blank sentence, answered as a lesson's question is: tap an option or press its
 * number (`picked`, which can still change), then Check shows the right answer and why
 * (`answer`). Nothing is saved until the last one.
 */
export function PatternDrillQuestion({
  answer,
  index,
  onPick,
  picked,
  question,
}: {
  /** The checked answer, or null before Check. */
  answer: string | null;
  index: number;
  onPick: (option: string) => void;
  picked: string | null;
  question: DrillQuestion;
}) {
  const selectedIndex = picked === null ? -1 : question.options.indexOf(picked);

  return (
    <ChoiceQuestion
      feedback={toFeedback({ answer, question })}
      onSelect={(choice) => {
        const option =
          choice && "selectedIndex" in choice ? question.options[choice.selectedIndex] : null;

        if (option !== undefined && option !== null) {
          onPick(option);
        }
      }}
      question={toChoiceQuestion({ index, question })}
      selected={selectedIndex === -1 ? null : { selectedIndex }}
    />
  );
}

/** The drill's score as a readout ("5/6"), its words small beside it. */
function readoutScore(chunks: React.ReactNode) {
  return <ReadoutNumber className="text-foreground">{chunks}</ReadoutNumber>;
}

/**
 * The drill's result, as every task's end reads: right answers of the total as a readout ("5/6
 * right", screen readers hear "5 of 6 right"), the Brain Power it paid in its violet, and what it
 * did to the day.
 */
export function PatternDrillResult({
  buddy,
  result,
}: {
  buddy?: LearnBuddy | null;
  result: PatternPracticeResult;
}) {
  const t = useExtracted();
  const allRight = result.correct === result.total;
  const counts = { correct: result.correct, total: result.total };

  return (
    <div aria-live="polite" className="flex flex-col items-start gap-3 py-6" role="status">
      <div className="flex flex-wrap items-baseline gap-x-8 gap-y-2">
        <h1
          className="text-muted-foreground text-sm font-medium outline-none"
          {...MOMENT_TITLE_PROPS}
        >
          <span aria-hidden="true">
            {t.rich("<score>{correct, number}/{total, number}</score> right", {
              ...counts,
              score: readoutScore,
            })}
          </span>
          <span className="sr-only">{t("{correct, number} of {total, number} right", counts)}</span>
        </h1>
        {result.brainPower > 0 && (
          <p>
            <BrainPowerReadout points={result.brainPower} />
          </p>
        )}
      </div>
      <p className="text-muted-foreground text-pretty">
        {allRight
          ? t("You've got this rule.")
          : t("Knowing the rule is the first step. It gets easier each time you use it.")}
      </p>

      <DayMoment
        buddy={buddy}
        ceremony={result.ceremony}
        missionMoment={result.missionMoment ?? null}
        reached={result.reached}
      />
    </div>
  );
}
