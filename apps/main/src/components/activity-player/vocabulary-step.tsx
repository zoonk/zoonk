"use client";

import { type SerializedStep, type SerializedWord } from "@/data/activities/prepare-activity-data";
import { Volume2Icon } from "lucide-react";
import { useExtracted } from "next-intl";
import { OptionCard } from "./option-card";
import { type SelectedAnswer, type StepResult } from "./player-reducer";
import { ResultAnnouncement } from "./result-announcement";
import { SectionLabel } from "./section-label";
import { InteractiveStepLayout } from "./step-layouts";
import { useOptionKeyboard } from "./use-option-keyboard";
import { useWordAudio } from "./use-word-audio";

function getSelectedWordId(selectedAnswer: SelectedAnswer | undefined): string | null {
  if (selectedAnswer?.kind !== "vocabulary") {
    return null;
  }

  return selectedAnswer.selectedWordId;
}

function getOptionResultState(
  wordId: string,
  correctWordId: string,
  selectedWordId: string,
): "correct" | "incorrect" | undefined {
  if (wordId === correctWordId) {
    return "correct";
  }

  if (wordId === selectedWordId) {
    return "incorrect";
  }

  return undefined;
}

function VocabularyOptionContent({
  isSelected,
  word,
}: {
  isSelected: boolean;
  word: SerializedWord;
}) {
  return (
    <>
      <span className="text-base leading-6">{word.word}</span>

      {word.romanization && (
        <span className="text-muted-foreground text-sm italic">{word.romanization}</span>
      )}

      {isSelected && word.pronunciation && (
        <span className="text-muted-foreground flex items-center gap-1 text-sm">
          <Volume2Icon aria-hidden="true" className="size-3.5" />
          {word.pronunciation}
        </span>
      )}
    </>
  );
}

export function VocabularyStep({
  onSelectAnswer,
  result,
  selectedAnswer,
  step,
}: {
  onSelectAnswer: (stepId: string, answer: SelectedAnswer) => void;
  result?: StepResult;
  selectedAnswer: SelectedAnswer | undefined;
  step: SerializedStep;
}) {
  const t = useExtracted();
  const { play } = useWordAudio();
  const correctWord = step.word;
  const selectedWordId = getSelectedWordId(selectedAnswer);
  const options = step.vocabularyOptions;

  const handleSelect = (index: number) => {
    if (result) {
      return;
    }

    const word = options[index];

    if (!word) {
      return;
    }

    play(word.audioUrl);
    onSelectAnswer(step.id, { kind: "vocabulary", selectedWordId: word.id });
  };

  useOptionKeyboard({
    enabled: !result,
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
        <p className="text-xl font-semibold">{correctWord.translation}</p>
      </div>

      <div aria-label={t("Answer options")} className="flex flex-col gap-3" role="radiogroup">
        {options.map((word, index) => {
          const isSelected = selectedWordId === word.id;

          return (
            <OptionCard
              disabled={Boolean(result)}
              index={index}
              isSelected={isSelected}
              key={word.id}
              onSelect={() => handleSelect(index)}
              resultState={
                result && selectedWordId
                  ? getOptionResultState(word.id, correctWord.id, selectedWordId)
                  : undefined
              }
            >
              <VocabularyOptionContent isSelected={isSelected} word={word} />
            </OptionCard>
          );
        })}
      </div>

      {result && <ResultAnnouncement isCorrect={result.result.isCorrect} />}
    </InteractiveStepLayout>
  );
}
