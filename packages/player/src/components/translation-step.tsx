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

/**
 * A word or chunk to translate, picked from words that each play their sound when tapped. Once
 * checked, the options show the right word and a wrong pick.
 */
export function TranslationStep({
  definesWords = false,
  onSelectAnswer,
  result,
  selectedAnswer,
  step,
}: {
  /** The lesson is in the learner's own language: the prompt is a definition, not a translation. */
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

  const handleSelect = (index: number) => {
    const word = options[index];

    if (!word || isChecked) {
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
        <PlayerChoiceSceneEyebrow>
          {definesWords ? t("Which one means this?") : t("Translate")}
        </PlayerChoiceSceneEyebrow>
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
