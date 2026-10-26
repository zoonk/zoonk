"use client";

import {
  buildAcceptedArrangeWordSequences,
  getAcceptedArrangeWordLengths,
} from "@zoonk/core/player/contracts/arrange-words-answers";
import { type SerializedStep } from "@zoonk/core/player/contracts/prepare-lesson-data";
import { useExtracted } from "next-intl";
import { type SelectedAnswer, type StepResult } from "../step-answer";
import { ArrangeWordsInteraction } from "./arrange-words";
import { PlayAudioButton } from "./play-audio-button";
import { QuestionText } from "./question-text";
import { ScreenChip } from "./screen-chip";

function AudioPrompt({ audioUrl }: { audioUrl: string }) {
  const t = useExtracted();

  return (
    <div className="flex flex-col gap-3">
      <ScreenChip>{t("What do you hear?")}</ScreenChip>
      <PlayAudioButton audioUrl={audioUrl} variant="labeled" />
    </div>
  );
}

function TextPrompt({ sentence }: { sentence: string }) {
  const t = useExtracted();

  return (
    <div className="flex flex-col gap-2">
      <ScreenChip>{t("Translate")}</ScreenChip>
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
  onSelectAnswer: (answer: SelectedAnswer | null) => void;
  result?: StepResult;
  selectedAnswer?: SelectedAnswer;
  step: SerializedStep;
}) {
  if (!step.sentence) {
    return null;
  }

  const acceptedWordSequences = buildAcceptedArrangeWordSequences(step.sentence.translation);
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
