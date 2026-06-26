"use client";

import { type DragEndEvent } from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { type WordBankOption } from "@zoonk/core/player/contracts/prepare-lesson-data";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { useCallback, useRef, useState } from "react";
import { useWebHaptics } from "web-haptics/react";
import { type SelectedAnswer, type StepResult } from "../player-reducer";
import { MAX_NUMBER_KEY_SHORTCUT, getNumberKeyShortcut } from "../player-shortcuts";
import { useOptionKeyboard } from "../use-option-keyboard";
import { useWordAudio } from "../use-word-audio";
import { ArrangeWordsAnswerArea, type PlacedWord } from "./arrange-words-answer-area";
import { InteractiveStepLayout } from "./step-layouts";
import { WordBankOptionButton } from "./word-bank-option-content";

type WordBankTile = {
  index: number;
  isUsed: boolean;
  key: string;
  option: WordBankOption;
  occurrenceNumber: number;
  shortcut: string | null;
};

type WordBankPlacement = { option: WordBankOption; sourceIndex: number };

/**
 * Source indexes are added when a learner chooses a tile in this session. They
 * let duplicate words behave like distinct toggles instead of guessing from the
 * visible word text alone.
 */
function hasPlacedWordSourceIndex(placedWord: PlacedWord): boolean {
  return typeof placedWord.sourceIndex === "number";
}

/**
 * Old saved/result answers only contain words. The occurrence number keeps that
 * legacy shape usable by matching the first tile to the first placed copy, the
 * second tile to the second placed copy, and so on.
 */
function getPlacedWordOccurrenceNumber({
  index,
  option,
  words,
}: {
  index: number;
  option: WordBankOption;
  words: WordBankOption[];
}): number {
  return words.slice(0, index + 1).filter((item) => item.word === option.word).length;
}

/**
 * Tile usage prefers exact source indexes when available and falls back to
 * occurrence counting for restored answers that predate source-index tracking.
 */
function isWordBankTileUsed({
  index,
  occurrenceNumber,
  option,
  placedWords,
}: {
  index: number;
  occurrenceNumber: number;
  option: WordBankOption;
  placedWords: PlacedWord[];
}): boolean {
  const hasSourceIndexes = placedWords.some((placedWord) => hasPlacedWordSourceIndex(placedWord));

  if (hasSourceIndexes) {
    return placedWords.some((placedWord) => placedWord.sourceIndex === index);
  }

  const usedCount = placedWords.filter((placed) => placed.word === option.word).length;
  return usedCount >= occurrenceNumber;
}

/**
 * Duplicate words are valid in generated word banks. Counting earlier
 * occurrences lets each duplicate tile become unavailable only after the
 * learner has placed that many copies of the same word.
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
  const occurrenceNumber = getPlacedWordOccurrenceNumber({ index, option, words });

  return {
    index,
    isUsed: isWordBankTileUsed({ index, occurrenceNumber, option, placedWords }),
    key: `bank-${option.word}-${index}`,
    occurrenceNumber,
    option,
    shortcut: getNumberKeyShortcut(index),
  };
}

/**
 * Builds the render and keyboard model for the word bank once so pointer and
 * number-key selection cannot disagree about which duplicate tile is still
 * available.
 */
function getWordBankTiles({
  placedWords,
  words,
}: {
  placedWords: PlacedWord[];
  words: WordBankOption[];
}): WordBankTile[] {
  return words.map((option, index) => getWordBankTile({ index, option, placedWords, words }));
}

/**
 * Finds the selected answer word controlled by a bank tile. Exact source-index
 * matches handle normal play, while occurrence matching keeps restored answers
 * removable even though they only know the selected word text.
 */
function getPlacedWordIndexForTile({
  placedWords,
  tile,
}: {
  placedWords: PlacedWord[];
  tile: WordBankTile;
}): number | null {
  const sourceIndexMatch = placedWords.findIndex(
    (placedWord) => placedWord.sourceIndex === tile.index,
  );

  if (sourceIndexMatch !== -1) {
    return sourceIndexMatch;
  }

  if (placedWords.some((placedWord) => hasPlacedWordSourceIndex(placedWord))) {
    return null;
  }

  const matchingIndexes = placedWords.flatMap((placedWord, index) =>
    placedWord.word === tile.option.word ? [index] : [],
  );

  return matchingIndexes[tile.occurrenceNumber - 1] ?? null;
}

function WordBank({
  disabled,
  onPlace,
  onRemove,
  placedWords,
  words,
}: {
  disabled: boolean;
  onPlace: (placement: WordBankPlacement) => void;
  onRemove: (index: number) => void;
  placedWords: PlacedWord[];
  words: WordBankOption[];
}) {
  const t = useExtracted();
  const tiles = getWordBankTiles({ placedWords, words });

  const handleToggleTile = useCallback(
    (tile: WordBankTile) => {
      if (!tile.isUsed) {
        onPlace({ option: tile.option, sourceIndex: tile.index });
        return;
      }

      const placedWordIndex = getPlacedWordIndexForTile({ placedWords, tile });

      if (placedWordIndex !== null) {
        onRemove(placedWordIndex);
      }
    },
    [onPlace, onRemove, placedWords],
  );

  useOptionKeyboard({
    enabled: !disabled,
    onSelect: (index) => {
      const tile = tiles[index];

      if (!tile) {
        return;
      }

      handleToggleTile(tile);
    },
    optionCount: Math.min(words.length, MAX_NUMBER_KEY_SHORTCUT),
  });

  return (
    <div
      aria-label={t("Word bank")}
      className={cn("flex flex-wrap gap-2.5", disabled && "pointer-events-none opacity-50")}
      role="group"
    >
      {tiles.map((tile) => (
        <WordBankOptionButton
          disabled={disabled}
          isUsed={tile.isUsed}
          key={tile.key}
          onToggle={() => handleToggleTile(tile)}
          option={tile.option}
          shortcut={tile.shortcut}
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
    ({ option, sourceIndex }: WordBankPlacement) => {
      if (placedWords.length >= maxAnswerLength) {
        return;
      }

      void play(option.audioUrl);
      const placed: PlacedWord = { ...option, id: String(idCounter.current), sourceIndex };
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
        onRemove={handleRemove}
        placedWords={placedWords}
        words={wordBankOptions}
      />
    </InteractiveStepLayout>
  );
}
