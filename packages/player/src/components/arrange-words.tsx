"use client";

import { type DragEndEvent } from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { type WordBankOption } from "@zoonk/core/player/contracts/prepare-lesson-data";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { useCallback, useRef, useState } from "react";
import { useWebHaptics } from "web-haptics/react";
import { type SelectedAnswer, type StepResult } from "../player-reducer";
import { useWordAudio } from "../use-word-audio";
import { ArrangeWordsAnswerArea, type PlacedWord } from "./arrange-words-answer-area";
import { InteractiveStepLayout } from "./step-layouts";
import { WordBankOptionButton } from "./word-bank-option-content";

type WordBankTile = { isUsed: boolean; key: string; option: WordBankOption };

/**
 * Duplicate words are valid, so a tile is considered used only when the learner
 * has already placed this exact occurrence of that word.
 */
function getWordBankTile({
  index,
  option,
  placedWords,
  words,
}: {
  index: number;
  option: WordBankOption;
  placedWords: PlacedWord[];
  words: WordBankOption[];
}): WordBankTile {
  const usedCount = placedWords.filter((placed) => placed.word === option.word).length;

  const occurrenceCount = words
    .slice(0, index + 1)
    .filter((item) => item.word === option.word).length;

  return { isUsed: usedCount >= occurrenceCount, key: `bank-${option.word}-${index}`, option };
}

/**
 * The word bank should only show words the learner can still choose. Selected
 * words remain removable from the answer area, then reappear here.
 */
function getVisibleWordBankTiles({
  placedWords,
  words,
}: {
  placedWords: PlacedWord[];
  words: WordBankOption[];
}): WordBankTile[] {
  return words
    .map((option, index) => getWordBankTile({ index, option, placedWords, words }))
    .filter((tile) => !tile.isUsed);
}

function WordBank({
  disabled,
  onPlace,
  placedWords,
  words,
}: {
  disabled: boolean;
  onPlace: (option: WordBankOption) => void;
  placedWords: PlacedWord[];
  words: WordBankOption[];
}) {
  const t = useExtracted();
  const tiles = getVisibleWordBankTiles({ placedWords, words });

  return (
    <div
      aria-label={t("Word bank")}
      className={cn("flex flex-wrap gap-2.5", disabled && "pointer-events-none opacity-50")}
      role="group"
    >
      {tiles.map((tile) => (
        <WordBankOptionButton
          disabled={disabled}
          key={tile.key}
          onToggle={() => onPlace(tile.option)}
          option={tile.option}
        />
      ))}
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
  selectedAnswer?: SelectedAnswer;
  stepId: string;
  wordBankOptions: WordBankOption[];
}) {
  const idCounter = useRef(0);
  const { trigger } = useWebHaptics();

  const [placedWords, setPlacedWords] = useState<PlacedWord[]>(() => {
    if (result?.answer?.kind === answerKind && "arrangedWords" in result.answer) {
      return result.answer.arrangedWords.map((word) => {
        const id = String(idCounter.current);
        idCounter.current += 1;

        return {
          audioUrl: null,
          id,
          pronunciation: null,
          romanization: null,
          translation: null,
          word,
        };
      });
    }

    return [];
  });

  const { play } = useWordAudio({ preloadUrls: wordBankOptions.map((option) => option.audioUrl) });

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
      if (result || placedWords.length >= maxAnswerLength) {
        return;
      }

      void play(option.audioUrl);
      const placed: PlacedWord = { ...option, id: String(idCounter.current) };
      idCounter.current += 1;
      const next = [...placedWords, placed];
      setPlacedWords(next);

      syncSelectedAnswer(next);
    },
    [maxAnswerLength, placedWords, play, result, syncSelectedAnswer],
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
    void trigger("selection");
  }, [trigger]);

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

      <WordBank
        disabled={result !== undefined}
        onPlace={handlePlace}
        placedWords={placedWords}
        words={wordBankOptions}
      />
    </InteractiveStepLayout>
  );
}
