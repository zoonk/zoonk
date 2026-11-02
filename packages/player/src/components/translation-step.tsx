"use client";

import {
  type SerializedStep,
  type TranslationOption,
} from "@zoonk/core/player/contracts/prepare-lesson-data";
import { useExtracted } from "next-intl";
import { type SelectedAnswer, type StepResult } from "../step-answer";
import { useWordAudio } from "../use-word-audio";
import {
  PlayerChoiceScene,
  PlayerChoiceSceneOptionText,
  PlayerChoiceSceneOptions,
  PlayerChoiceScenePrompt,
  PlayerChoiceSceneQuestion,
} from "./player-choice-scene";
import { RomanizationText } from "./romanization-text";
import { ScreenChip } from "./screen-chip";

function getSelectedOptionId(selectedAnswer?: SelectedAnswer): string | null {
  if (selectedAnswer?.kind !== "translation") {
    return null;
  }

  return selectedAnswer.selectedOptionId;
}

function TranslationOptionContent({ word }: { word: TranslationOption }) {
  return (
    <>
      <PlayerChoiceSceneOptionText>{word.word}</PlayerChoiceSceneOptionText>
      <RomanizationText>{word.romanization}</RomanizationText>
    </>
  );
}

export function TranslationStep({
  definesWords = false,
  onSelectAnswer,
  result,
  selectedAnswer,
  step,
}: {
  definesWords?: boolean;
  onSelectAnswer: (answer: SelectedAnswer) => void;
  result?: StepResult;
  selectedAnswer?: SelectedAnswer;
  step: SerializedStep;
}) {
  const t = useExtracted();
  const correctWord = step.word;
  const selectedOptionId = getSelectedOptionId(selectedAnswer);
  const options = step.translationOptions;
  const isChecked = result !== undefined;

  const { play } = useWordAudio({ preloadUrls: options.map((word) => word.audioUrl) });

  const handleSelect = (id: string) => {
    void play(options.find((word) => word.id === id)?.audioUrl ?? null);
    onSelectAnswer({ kind: "translation", selectedOptionId: id });
  };

  if (!correctWord) {
    return null;
  }

  return (
    <PlayerChoiceScene>
      <PlayerChoiceScenePrompt>
        <ScreenChip>{definesWords ? t("Which one means this?") : t("Translate")}</ScreenChip>
        <PlayerChoiceSceneQuestion>{correctWord.translation}</PlayerChoiceSceneQuestion>
      </PlayerChoiceScenePrompt>

      <PlayerChoiceSceneOptions
        isChecked={isChecked}
        onSelect={handleSelect}
        options={options.map((word) => ({
          content: <TranslationOptionContent word={word} />,
          isCorrect: word.id === correctWord.id,
          key: word.id,
        }))}
        selectedKey={selectedOptionId}
      />
    </PlayerChoiceScene>
  );
}
