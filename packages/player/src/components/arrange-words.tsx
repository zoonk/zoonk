"use client";

import { type DragEndEvent } from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { useCallback, useRef, useState } from "react";
import { type SelectedAnswer, type StepResult } from "../player-reducer";
import { type WordBankOption } from "../prepare-activity-data";
import { useWordAudio } from "../use-word-audio";
import { ArrangeWordsAnswerArea, type PlacedWord } from "./arrange-words-answer-area";
import { RomanizationText } from "./romanization-text";
import { InteractiveStepLayout } from "./step-layouts";

function BankTileContent({ option }: { option: WordBankOption }) {
  return (
    <>
      <span>{option.word}</span>

      <RomanizationText>{option.romanization}</RomanizationText>
    </>
  );
}

function BankTile({
  isUsed,
  onPlace,
  option,
}: {
  isUsed: boolean;
  onPlace: () => void;
  option: WordBankOption;
}) {
  return (
    <button
      aria-disabled={isUsed}
      className={cn(
        "border-border flex min-h-11 flex-col items-center justify-center rounded-lg border px-4 py-2.5 transition-all duration-150",
        isUsed
          ? "pointer-events-none opacity-30"
          : "hover:bg-accent focus-visible:border-ring focus-visible:ring-ring/50 outline-none focus-visible:ring-[3px]",
      )}
      onClick={onPlace}
      tabIndex={isUsed ? -1 : 0}
      type="button"
    >
      <BankTileContent option={option} />
    </button>
  );
}

function WordBank({
  onPlace,
  placedWords,
  words,
}: {
  onPlace: (option: WordBankOption) => void;
  placedWords: WordBankOption[];
  words: WordBankOption[];
}) {
  const t = useExtracted();

  return (
    <div aria-label={t("Word bank")} className="flex flex-wrap gap-2.5" role="group">
      {words.map((option, index) => {
        const usedCount = placedWords.filter((placed) => placed.word === option.word).length;
        const totalCount = words
          .slice(0, index + 1)
          .filter((item) => item.word === option.word).length;
        const isUsed = usedCount >= totalCount;

        return (
          <BankTile
            isUsed={isUsed}
            // oxlint-disable-next-line react/no-array-index-key -- Words can repeat in word bank, no unique ID
            key={`bank-${option.word}-${index}`}
            onPlace={() => onPlace(option)}
            option={option}
          />
        );
      })}
    </div>
  );
}

export function ArrangeWordsInteraction({
  acceptedWordLengths,
  answerKind,
  children,
  correctWords,
  onSelectAnswer,
  result,
  selectedAnswer,
  stepId,
  wordBankOptions,
}: {
  acceptedWordLengths: number[];
  answerKind: "reading" | "listening";
  children: React.ReactNode;
  correctWords: string[];
  onSelectAnswer: (stepId: string, answer: SelectedAnswer | null) => void;
  result?: StepResult;
  selectedAnswer: SelectedAnswer | undefined;
  stepId: string;
  wordBankOptions: WordBankOption[];
}) {
  const idCounter = useRef(0);

  const [placedWords, setPlacedWords] = useState<PlacedWord[]>(() => {
    if (result?.answer?.kind === answerKind && "arrangedWords" in result.answer) {
      return result.answer.arrangedWords.map((word) => {
        const id = String(idCounter.current);
        idCounter.current += 1;
        return { audioUrl: null, id, romanization: null, translation: null, word };
      });
    }

    return [];
  });

  const { play } = useWordAudio();
  const maxAnswerLength = Math.max(...acceptedWordLengths, correctWords.length);

  const syncSelectedAnswer = useCallback(
    (next: PlacedWord[]) => {
      const arrangedWords = next.map((placedWord) => placedWord.word);

      if (acceptedWordLengths.includes(next.length)) {
        onSelectAnswer(stepId, { arrangedWords, kind: answerKind });
        return;
      }

      if (selectedAnswer) {
        onSelectAnswer(stepId, null);
      }
    },
    [acceptedWordLengths, answerKind, onSelectAnswer, selectedAnswer, stepId],
  );

  const handlePlace = useCallback(
    (option: WordBankOption) => {
      if (placedWords.length >= maxAnswerLength) {
        return;
      }

      play(option.audioUrl);
      const placed: PlacedWord = { ...option, id: String(idCounter.current) };
      idCounter.current += 1;
      const next = [...placedWords, placed];
      setPlacedWords(next);

      syncSelectedAnswer(next);
    },
    [maxAnswerLength, placedWords, play, syncSelectedAnswer],
  );

  const handleRemove = useCallback(
    (index: number) => {
      const next = placedWords.filter((_, idx) => idx !== index);
      setPlacedWords(next);
      syncSelectedAnswer(next);
    },
    [placedWords, syncSelectedAnswer],
  );

  const handleDragStart = useCallback(() => {
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate(10);
    }
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;

      if (!over || active.id === over.id) {
        return;
      }

      const oldIndex = placedWords.findIndex((pw) => pw.id === String(active.id));
      const newIndex = placedWords.findIndex((pw) => pw.id === String(over.id));

      if (oldIndex === -1 || newIndex === -1) {
        return;
      }

      const reordered = arrayMove(placedWords, oldIndex, newIndex);
      setPlacedWords(reordered);

      syncSelectedAnswer(reordered);
    },
    [placedWords, syncSelectedAnswer],
  );

  return (
    <InteractiveStepLayout>
      {children}

      <ArrangeWordsAnswerArea
        correctWords={correctWords}
        onDragEnd={handleDragEnd}
        onDragStart={handleDragStart}
        onRemove={handleRemove}
        placedWords={placedWords}
        result={result}
      />

      <WordBank onPlace={handlePlace} placedWords={placedWords} words={wordBankOptions} />
    </InteractiveStepLayout>
  );
}
