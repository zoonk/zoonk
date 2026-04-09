"use client";

import { useExtracted } from "next-intl";
import { type SelectedAnswer } from "../player-reducer";
import { type SerializedStep, type TranslationOption } from "../prepare-activity-data";
import { useWordAudio } from "../use-word-audio";
import {
  PlayerChoiceScene,
  PlayerChoiceSceneEyebrow,
  PlayerChoiceSceneOptions,
  PlayerChoiceScenePrompt,
  PlayerChoiceSceneQuestion,
} from "./player-choice-scene";
import { RomanizationText } from "./romanization-text";

function getSelectedWordId(selectedAnswer: SelectedAnswer | undefined): string | null {
  if (selectedAnswer?.kind !== "translation") {
    return null;
  }

  return selectedAnswer.selectedWordId;
}

function TranslationOptionContent({
  isSelected,
  word,
}: {
  isSelected: boolean;
  word: TranslationOption;
}) {
  return (
    <>
      <span className="text-base leading-6">{word.word}</span>

      <RomanizationText>{word.romanization}</RomanizationText>

      {isSelected && word.pronunciation && (
        <span className="text-muted-foreground text-sm">{word.pronunciation}</span>
      )}
    </>
  );
}

export function TranslationStep({
  onSelectAnswer,
  selectedAnswer,
  step,
}: {
  onSelectAnswer: (stepId: string, answer: SelectedAnswer) => void;
  selectedAnswer: SelectedAnswer | undefined;
  step: SerializedStep;
}) {
  const t = useExtracted();
  const correctWord = step.word;
  const selectedWordId = getSelectedWordId(selectedAnswer);
  const options = step.translationOptions;

  const { play } = useWordAudio({
    preloadUrls: options.map((word) => word.audioUrl),
  });

  const handleSelect = (index: number) => {
    const word = options[index];

    if (!word) {
      return;
    }

    play(word.audioUrl);
    onSelectAnswer(step.id, {
      kind: "translation",
      questionText: correctWord?.translation ?? "",
      selectedText: word.word,
      selectedWordId: word.id,
    });
  };

  if (!correctWord) {
    return null;
  }

  return (
    <PlayerChoiceScene>
      <PlayerChoiceScenePrompt>
        <PlayerChoiceSceneEyebrow>{t("Translate this word:")}</PlayerChoiceSceneEyebrow>
        <PlayerChoiceSceneQuestion>{correctWord.translation}</PlayerChoiceSceneQuestion>
      </PlayerChoiceScenePrompt>

      <PlayerChoiceSceneOptions
        keyboardEnabled={!selectedAnswer || selectedAnswer.kind === "translation"}
        onSelect={handleSelect}
        options={options.map((word) => ({
          content: <TranslationOptionContent isSelected={selectedWordId === word.id} word={word} />,
          isSelected: selectedWordId === word.id,
          key: word.id,
        }))}
      />
    </PlayerChoiceScene>
  );
}
