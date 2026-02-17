"use client";

import { type SerializedStep, type SerializedWord } from "@/data/activities/prepare-activity-data";
import { Kbd } from "@zoonk/ui/components/kbd";
import { cn } from "@zoonk/ui/lib/utils";
import { CheckIcon, Volume2Icon, XIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { type SelectedAnswer, type StepResult } from "./player-reducer";
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

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">{children}</p>
  );
}

function OptionKbd({
  index,
  isSelected,
  resultState,
}: {
  index: number;
  isSelected: boolean;
  resultState?: "correct" | "incorrect";
}) {
  if (resultState === "correct") {
    return (
      <Kbd aria-hidden="true" className="bg-success text-white">
        <CheckIcon aria-hidden="true" className="size-3" />
      </Kbd>
    );
  }

  if (resultState === "incorrect") {
    return (
      <Kbd aria-hidden="true" className="bg-destructive text-white">
        <XIcon aria-hidden="true" className="size-3" />
      </Kbd>
    );
  }

  return (
    <Kbd aria-hidden="true" className={cn(isSelected && "bg-primary text-primary-foreground")}>
      {index + 1}
    </Kbd>
  );
}

function OptionCard({
  index,
  isSelected,
  onSelect,
  resultState,
  word,
}: {
  index: number;
  isSelected: boolean;
  onSelect: () => void;
  resultState?: "correct" | "incorrect";
  word: SerializedWord;
}) {
  const hasResult = resultState !== undefined;

  return (
    <button
      aria-checked={isSelected}
      className={cn(
        "focus-visible:border-ring focus-visible:ring-ring/50 flex w-full items-center gap-3 rounded-xl border px-4 py-3.5 text-left transition-colors duration-150 outline-none focus-visible:ring-[3px]",
        !hasResult && !isSelected && "border-border hover:bg-accent",
        !hasResult && isSelected && "border-primary bg-primary/5",
        hasResult && "pointer-events-none",
        resultState === "correct" && "border-l-success border-l-2",
        resultState === "incorrect" && "border-l-destructive border-l-2",
      )}
      disabled={hasResult}
      onClick={onSelect}
      role="radio"
      type="button"
    >
      <OptionKbd index={index} isSelected={isSelected} resultState={resultState} />

      <div className="flex flex-col">
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
      </div>
    </button>
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
        {options.map((word, index) => (
          <OptionCard
            index={index}
            isSelected={selectedWordId === word.id}
            key={word.id}
            onSelect={() => handleSelect(index)}
            resultState={
              result && selectedWordId
                ? getOptionResultState(word.id, correctWord.id, selectedWordId)
                : undefined
            }
            word={word}
          />
        ))}
      </div>

      {result && (
        <div aria-live="polite" className="sr-only" role="status">
          {result.result.isCorrect ? t("Correct") : t("Incorrect")}
        </div>
      )}
    </InteractiveStepLayout>
  );
}
