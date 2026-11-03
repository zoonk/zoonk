"use client";

import { type SerializedStep } from "@zoonk/core/player/contracts/prepare-lesson-data";
import { useExtracted } from "next-intl";
import { type PromptAudio, usePromptAudio } from "../player-audio-context";
import { type SelectedAnswer, type StepResult } from "../step-answer";
import { ArrangeWordsInteraction } from "./arrange-words";
import { PromptAudioButton } from "./prompt-audio-button";
import { QuestionText } from "./question-text";
import { ScreenChip } from "./screen-chip";

function AudioPrompt({ audio }: { audio: PromptAudio }) {
  const t = useExtracted();

  return (
    <div className="flex flex-col gap-3">
      <ScreenChip>{t("What do you hear?")}</ScreenChip>
      <PromptAudioButton audio={audio} variant="labeled" />
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
  const audio = usePromptAudio();

  if (!step.sentence) {
    return null;
  }

  return (
    <ArrangeWordsInteraction
      answer={step.sentence.translation}
      answerKind="listening"
      onSelectAnswer={onSelectAnswer}
      result={result}
      selectedAnswer={selectedAnswer}
      wordBankOptions={step.wordBankOptions}
    >
      {audio ? <AudioPrompt audio={audio} /> : <TextPrompt sentence={step.sentence.sentence} />}
    </ArrangeWordsInteraction>
  );
}
