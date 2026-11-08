"use client";

import { type DragEndEvent } from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { segmentArrangeWords } from "@zoonk/core/player/contracts/arrange-words-answers";
import { type WordBankOption } from "@zoonk/core/player/contracts/prepare-lesson-data";
import { useRef, useState } from "react";
import { useWebHaptics } from "web-haptics/react";
import { type SelectedAnswer, type StepResult } from "../step-answer";
import { useWordAudio } from "../use-word-audio";
import { ArrangeWordsAnswerArea, type PlacedWord } from "./arrange-words-answer-area";
import { InteractiveStepLayout } from "./step-layouts";
import { WordBank } from "./word-bank";

type WordBankTile = { index: number; isUsed: boolean; key: string; option: WordBankOption };
type PlacedWordWithBankIndex = PlacedWord & { wordBankIndex: number | null };

function isUntrackedOccurrenceUsed({
  index,
  option,
  placedWords,
  words,
}: {
  index: number;
  option: WordBankOption;
  placedWords: PlacedWordWithBankIndex[];
  words: WordBankOption[];
}): boolean {
  const usedCount = placedWords.filter(
    (placed) => placed.wordBankIndex === null && placed.word === option.word,
  ).length;

  const occurrenceCount = words
    .slice(0, index + 1)
    .filter((item) => item.word === option.word).length;

  return usedCount >= occurrenceCount;
}

function getWordBankTile({
  index,
  option,
  placedWords,
  words,
}: {
  index: number;
  option: WordBankOption;
  placedWords: PlacedWordWithBankIndex[];
  words: WordBankOption[];
}): WordBankTile {
  const isUsed =
    placedWords.some((placed) => placed.wordBankIndex === index) ||
    isUntrackedOccurrenceUsed({ index, option, placedWords, words });

  return { index, isUsed, key: `bank-${option.word}-${index}`, option };
}

function getWordBankTiles({
  placedWords,
  words,
}: {
  placedWords: PlacedWordWithBankIndex[];
  words: WordBankOption[];
}): WordBankTile[] {
  return words.map((option, index) => getWordBankTile({ index, option, placedWords, words }));
}

export function ArrangeWordsInteraction({
  answer,
  answerKind,
  children,
  isLocked: isStepLocked,
  onSelectAnswer,
  result,
  selectedAnswer,
  wordBankOptions,
}: {
  answer: string;
  answerKind: "reading" | "listening";
  children: React.ReactNode;
  isLocked: boolean;
  onSelectAnswer: (answer: SelectedAnswer | null) => void;
  result?: StepResult;
  selectedAnswer?: SelectedAnswer;
  wordBankOptions: WordBankOption[];
}) {
  const { trigger } = useWebHaptics();
  const isLocked = isStepLocked || result !== undefined;

  const correctWords = segmentArrangeWords({ kind: answerKind, text: answer });

  const [placedWords, setPlacedWords] = useState<PlacedWordWithBankIndex[]>(() => {
    if (result?.answer?.kind === answerKind && "arrangedWords" in result.answer) {
      return result.answer.arrangedWords.map((word, index) => ({
        audioUrl: null,
        id: String(index),
        romanization: null,
        translation: null,
        word,
        wordBankIndex: null,
      }));
    }

    return [];
  });

  const idCounter = useRef(placedWords.length);

  const { play } = useWordAudio({ preloadUrls: wordBankOptions.map((option) => option.audioUrl) });

  const syncSelectedAnswer = (next: PlacedWordWithBankIndex[]) => {
    const arrangedWords = next.map((placedWord) => placedWord.word);

    if (next.length === correctWords.length) {
      onSelectAnswer({ arrangedWords, kind: answerKind });
      return;
    }

    if (selectedAnswer) {
      onSelectAnswer(null);
    }
  };

  const handlePlace = (tile: WordBankTile) => {
    if (isLocked || placedWords.length >= correctWords.length) {
      return;
    }

    void play(tile.option.audioUrl);

    const placed: PlacedWordWithBankIndex = {
      ...tile.option,
      id: String(idCounter.current),
      wordBankIndex: tile.index,
    };

    idCounter.current += 1;
    const next = [...placedWords, placed];
    setPlacedWords(next);
    syncSelectedAnswer(next);
  };

  const handleRemove = (index: number) => {
    const next = placedWords.filter((_, idx) => idx !== index);
    setPlacedWords(next);
    syncSelectedAnswer(next);
  };

  const handleDragEnd = (event: DragEndEvent) => {
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
  };

  return (
    <InteractiveStepLayout>
      {children}

      <ArrangeWordsAnswerArea
        correctWords={correctWords}
        onDragEnd={handleDragEnd}
        onDragStart={() => void trigger("selection")}
        isLocked={isLocked}
        onRemove={handleRemove}
        placedWords={placedWords}
        result={result}
      />

      <WordBank
        disabled={isLocked}
        onPlace={handlePlace}
        tiles={getWordBankTiles({ placedWords, words: wordBankOptions })}
      />
    </InteractiveStepLayout>
  );
}
