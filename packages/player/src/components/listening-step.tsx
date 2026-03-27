"use client";

import { useExtracted } from "next-intl";
import {
  buildAcceptedArrangeWordSequences,
  getAcceptedArrangeWordLengths,
} from "../arrange-words-answers";
import { type SelectedAnswer, type StepResult } from "../player-reducer";
import { type SerializedStep } from "../prepare-activity-data";
import { ArrangeWordsInteraction } from "./arrange-words";
import { PlayAudioButton } from "./play-audio-button";
import { QuestionText } from "./question-text";
import { SectionLabel } from "./section-label";

function AudioPrompt({ audioUrl }: { audioUrl: string }) {
  const t = useExtracted();

  return (
    <div className="flex flex-col gap-3">
      <SectionLabel>{t("What do you hear?")}</SectionLabel>
      <PlayAudioButton audioUrl={audioUrl} />
    </div>
  );
}

function TextPrompt({ sentence }: { sentence: string }) {
  const t = useExtracted();

  return (
    <div className="flex flex-col gap-2">
      <SectionLabel>{t("Translate this sentence:")}</SectionLabel>
      <QuestionText>{sentence}</QuestionText>
    </div>
  );
}

export function ListeningStep({
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
  if (!step.sentence) {
    return null;
  }

  const acceptedWordSequences = buildAcceptedArrangeWordSequences(step.sentence.translation, []);
  const correctWords = acceptedWordSequences[0] ?? [];
  const acceptedWordLengths = getAcceptedArrangeWordLengths(acceptedWordSequences);

  return (
    <ArrangeWordsInteraction
      acceptedWordLengths={acceptedWordLengths}
      answerKind="listening"
      correctWords={correctWords}
      onSelectAnswer={onSelectAnswer}
      result={result}
      selectedAnswer={selectedAnswer}
      stepId={step.id}
      wordBankOptions={step.wordBankOptions}
    >
      {step.sentence.audioUrl ? (
        <AudioPrompt audioUrl={step.sentence.audioUrl} />
      ) : (
        <TextPrompt sentence={step.sentence.sentence} />
      )}
    </ArrangeWordsInteraction>
  );
}
