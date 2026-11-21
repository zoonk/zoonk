"use client";

import { type SerializedStep } from "@zoonk/core/player/contracts/prepare-lesson-data";
import { Eyebrow } from "@zoonk/learn/eyebrow";
import { SoundInBar } from "@zoonk/learn/main-action-slot";
import { useExtracted } from "next-intl";
import { type PromptAudio, usePromptAudio } from "../player-audio-context";
import { type SelectedAnswer, type StepResult } from "../step-answer";
import { ArrangeWordsInteraction } from "./arrange-words";
import { PromptAudioButton } from "./prompt-audio-button";
import { QuestionText } from "./question-text";

function AudioPrompt({ audio, wayOuts }: { audio: PromptAudio; wayOuts: React.ReactNode }) {
  const t = useExtracted();

  return (
    <div className="flex flex-col gap-3">
      <QuestionText>{t("What do you hear?")}</QuestionText>

      <div className="flex flex-wrap gap-2 empty:hidden">
        <SoundInBar>
          <PromptAudioButton audio={audio} variant="icon" />
        </SoundInBar>
        {wayOuts}
      </div>
    </div>
  );
}

function TextPrompt({ sentence, wayOuts }: { sentence: string; wayOuts: React.ReactNode }) {
  const t = useExtracted();

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        <Eyebrow>{t("Translate")}</Eyebrow>
        <QuestionText>{sentence}</QuestionText>
      </div>

      <div className="flex flex-wrap gap-2 empty:hidden">{wayOuts}</div>
    </div>
  );
}

export function ListeningStep({
  isLocked,
  onSelectAnswer,
  result,
  selectedAnswer,
  step,
  wayOuts,
}: {
  isLocked: boolean;
  onSelectAnswer: (answer: SelectedAnswer | null) => void;
  result?: StepResult;
  selectedAnswer?: SelectedAnswer;
  step: SerializedStep;
  /** Ways around listening ("I can't listen now"), under the question, away from the word bank. */
  wayOuts?: React.ReactNode;
}) {
  const audio = usePromptAudio();

  if (!step.sentence) {
    return null;
  }

  return (
    <ArrangeWordsInteraction
      answer={step.sentence.translation}
      isLocked={isLocked}
      answerKind="listening"
      onSelectAnswer={onSelectAnswer}
      result={result}
      selectedAnswer={selectedAnswer}
      wordBankOptions={step.wordBankOptions}
    >
      {audio ? (
        <AudioPrompt audio={audio} wayOuts={wayOuts} />
      ) : (
        <TextPrompt sentence={step.sentence.sentence} wayOuts={wayOuts} />
      )}
    </ArrangeWordsInteraction>
  );
}
