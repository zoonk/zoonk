"use client";

import { useExtracted } from "next-intl";
import { type SelectedAnswer } from "../player-reducer";
import { type SerializedStep, type SerializedWord } from "../prepare-activity-data";
import { useOptionKeyboard } from "../use-option-keyboard";
import { useWordAudio } from "../use-word-audio";
import { OptionCard } from "./option-card";
import { QuestionText } from "./question-text";
import { RomanizationText } from "./romanization-text";
import { SectionLabel } from "./section-label";
import { InteractiveStepLayout } from "./step-layouts";

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
  word: SerializedWord;
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

  useOptionKeyboard({
    enabled: !selectedAnswer || selectedAnswer.kind === "translation",
    onSelect: handleSelect,
    optionCount: options.length,
  });

  if (!correctWord) {
    return null;
  }

  return (
    <InteractiveStepLayout>
      <div className="flex flex-col gap-2">
        <SectionLabel>{t("Translate this word:")}</SectionLabel>
        <QuestionText>{correctWord.translation}</QuestionText>
      </div>

      <div aria-label={t("Answer options")} className="flex flex-col gap-3" role="radiogroup">
        {options.map((word, index) => (
          <OptionCard
            index={index}
            isSelected={selectedWordId === word.id}
            key={word.id}
            onSelect={() => handleSelect(index)}
          >
            <TranslationOptionContent isSelected={selectedWordId === word.id} word={word} />
          </OptionCard>
        ))}
      </div>
    </InteractiveStepLayout>
  );
}
