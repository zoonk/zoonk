"use client";

import { useExtracted } from "next-intl";
import { type SelectedAnswer, type StepResult } from "../player-reducer";
import { type SerializedStep } from "../prepare-activity-data";
import { ArrangeWordsInteraction } from "./arrange-words";
import { QuestionText } from "./question-text";
import { SectionLabel } from "./section-label";

export function ReadingStep({
  onSelectAnswer,
  result,
  selectedAnswer,
  step,
}: {
  onSelectAnswer: (stepId: string, answer: SelectedAnswer | null) => void;
  result?: StepResult;
  selectedAnswer: SelectedAnswer | undefined;
  step: SerializedStep;
}) {
  const t = useExtracted();

  if (!step.sentence) {
    return null;
  }

  return (
    <ArrangeWordsInteraction
      answerKind="reading"
      correctSentence={step.sentence.sentence}
      correctWords={step.sentence.sentence.split(" ")}
      onSelectAnswer={onSelectAnswer}
      result={result}
      selectedAnswer={selectedAnswer}
      stepId={step.id}
      wordBankOptions={step.wordBankOptions}
    >
      <div className="flex flex-col gap-2">
        <SectionLabel>{t("Translate this sentence:")}</SectionLabel>
        <QuestionText>{step.sentence.translation}</QuestionText>
      </div>
    </ArrangeWordsInteraction>
  );
}
