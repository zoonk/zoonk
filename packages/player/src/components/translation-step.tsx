"use client";

import {
  type SerializedStep,
  type TranslationOption,
} from "@zoonk/core/player/contracts/prepare-lesson-data";
import { useExtracted } from "next-intl";
import { type SelectedAnswer } from "../step-answer";
import { useWordAudio } from "../use-word-audio";
import {
  PlayerChoiceScene,
  PlayerChoiceSceneEyebrow,
  PlayerChoiceSceneOptionText,
  PlayerChoiceSceneOptions,
  PlayerChoiceScenePrompt,
  PlayerChoiceSceneQuestion,
} from "./player-choice-scene";
import { RomanizationText } from "./romanization-text";

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
  onSelectAnswer,
  selectedAnswer,
  step,
}: {
  onSelectAnswer: (answer: SelectedAnswer) => void;
  selectedAnswer?: SelectedAnswer;
  step: SerializedStep;
}) {
  const t = useExtracted();
  const correctWord = step.word;
  const selectedOptionId = getSelectedOptionId(selectedAnswer);
  const options = step.translationOptions;

  const { play } = useWordAudio({ preloadUrls: options.map((word) => word.audioUrl) });

  const handleSelect = (index: number) => {
    const word = options[index];

    if (!word) {
      return;
    }

    void play(word.audioUrl);
    onSelectAnswer({ kind: "translation", selectedOptionId: word.id });
  };

  if (!correctWord) {
    return null;
  }

  return (
    <PlayerChoiceScene>
      <PlayerChoiceScenePrompt>
        {/* A word carries its article ("as colunas") and a chunk is several words ("Thanks for
        having me"): the prompt names neither, so it never calls one the other. */}
        <PlayerChoiceSceneEyebrow>{t("Translate:")}</PlayerChoiceSceneEyebrow>
        <PlayerChoiceSceneQuestion>{correctWord.translation}</PlayerChoiceSceneQuestion>
      </PlayerChoiceScenePrompt>

      <PlayerChoiceSceneOptions
        keyboardEnabled={!selectedAnswer || selectedAnswer.kind === "translation"}
        onSelect={handleSelect}
        options={options.map((word) => ({
          content: <TranslationOptionContent word={word} />,
          isSelected: selectedOptionId === word.id,
          key: word.id,
        }))}
      />
    </PlayerChoiceScene>
  );
}
