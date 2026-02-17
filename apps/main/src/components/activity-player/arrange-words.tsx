"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { useCallback, useState } from "react";
import { type SelectedAnswer, type StepResult } from "./player-reducer";
import { ResultAnnouncement } from "./result-announcement";
import { InteractiveStepLayout } from "./step-layouts";

function getWordResultState(
  word: string,
  position: number,
  correctWords: string[],
): "correct" | "incorrect" {
  return correctWords[position] === word ? "correct" : "incorrect";
}

function PlacedWordTile({
  onClick,
  position,
  resultState,
  word,
}: {
  onClick: () => void;
  position: number;
  resultState?: "correct" | "incorrect";
  word: string;
}) {
  const t = useExtracted();
  const hasResult = resultState !== undefined;

  const ariaLabel = (() => {
    if (hasResult) {
      const result = resultState === "correct" ? t("Correct") : t("Incorrect");
      return t("{item}. {result}.", { item: word, result });
    }

    return t("Position {position}: {item}. Tap to remove.", {
      item: word,
      position: String(position + 1),
    });
  })();

  return (
    <button
      aria-label={ariaLabel}
      className={cn(
        "border-border min-h-11 rounded-lg border px-4 py-2.5 text-base transition-all duration-150",
        hasResult && "pointer-events-none",
        !hasResult &&
          "hover:bg-accent focus-visible:border-ring focus-visible:ring-ring/50 outline-none focus-visible:ring-[3px]",
        resultState === "correct" && "border-l-success border-l-2",
        resultState === "incorrect" && "border-l-destructive border-l-2",
      )}
      disabled={hasResult}
      onClick={onClick}
      type="button"
    >
      {word}
    </button>
  );
}

function AnswerArea({
  correctWords,
  onRemove,
  placedWords,
  result,
}: {
  correctWords: string[];
  onRemove: (index: number) => void;
  placedWords: string[];
  result?: StepResult;
}) {
  const t = useExtracted();

  return (
    <div
      aria-label={t("Your answer")}
      className="border-border/40 flex min-h-16 flex-wrap gap-2 border-b pb-3"
      role="group"
    >
      {placedWords.length === 0 ? (
        <p className="text-muted-foreground/60 text-sm">{t("Tap words to build your answer")}</p>
      ) : (
        placedWords.map((word, index) => (
          <PlacedWordTile
            // oxlint-disable-next-line react/no-array-index-key -- Words can repeat, no unique ID
            key={`placed-${word}-${index}`}
            onClick={() => onRemove(index)}
            position={index}
            resultState={result ? getWordResultState(word, index, correctWords) : undefined}
            word={word}
          />
        ))
      )}
    </div>
  );
}

function BankTile({
  isUsed,
  onPlace,
  word,
}: {
  isUsed: boolean;
  onPlace: () => void;
  word: string;
}) {
  return (
    <button
      aria-disabled={isUsed}
      className={cn(
        "border-border min-h-11 rounded-lg border px-4 py-2.5 transition-all duration-150",
        isUsed
          ? "pointer-events-none opacity-30"
          : "hover:bg-accent focus-visible:border-ring focus-visible:ring-ring/50 outline-none focus-visible:ring-[3px]",
      )}
      onClick={onPlace}
      tabIndex={isUsed ? -1 : 0}
      type="button"
    >
      {word}
    </button>
  );
}

function WordBank({
  onPlace,
  placedWords,
  words,
}: {
  onPlace: (word: string) => void;
  placedWords: string[];
  words: string[];
}) {
  const t = useExtracted();

  return (
    <div aria-label={t("Word bank")} className="flex flex-wrap gap-2.5" role="group">
      {words.map((word, index) => {
        const usedCount = placedWords.filter((placed) => placed === word).length;
        const totalCount = words.slice(0, index + 1).filter((item) => item === word).length;
        const isUsed = usedCount >= totalCount;

        return (
          <BankTile
            isUsed={isUsed}
            // oxlint-disable-next-line react/no-array-index-key -- Words can repeat in word bank, no unique ID
            key={`bank-${word}-${index}`}
            onPlace={() => onPlace(word)}
            word={word}
          />
        );
      })}
    </div>
  );
}

export function ArrangeWordsInteraction({
  answerKind,
  children,
  correctSentence,
  correctWords,
  onSelectAnswer,
  result,
  selectedAnswer,
  stepId,
  wordBankOptions,
}: {
  answerKind: "reading" | "listening";
  children: React.ReactNode;
  correctSentence: string;
  correctWords: string[];
  onSelectAnswer: (stepId: string, answer: SelectedAnswer | null) => void;
  result?: StepResult;
  selectedAnswer: SelectedAnswer | undefined;
  stepId: string;
  wordBankOptions: string[];
}) {
  const t = useExtracted();

  const [placedWords, setPlacedWords] = useState<string[]>(() => {
    if (result?.answer?.kind === answerKind && "arrangedWords" in result.answer) {
      return result.answer.arrangedWords;
    }

    return [];
  });

  const handlePlace = useCallback(
    (word: string) => {
      if (placedWords.length >= correctWords.length) {
        return;
      }

      const next = [...placedWords, word];
      setPlacedWords(next);

      if (next.length === correctWords.length) {
        onSelectAnswer(stepId, { arrangedWords: next, kind: answerKind });
      }
    },
    [answerKind, correctWords.length, onSelectAnswer, placedWords, stepId],
  );

  const handleRemove = useCallback(
    (index: number) => {
      const next = placedWords.filter((_, idx) => idx !== index);
      setPlacedWords(next);

      if (selectedAnswer) {
        onSelectAnswer(stepId, null);
      }
    },
    [onSelectAnswer, placedWords, selectedAnswer, stepId],
  );

  const isIncorrect = result && !result.result.isCorrect;

  return (
    <InteractiveStepLayout>
      {children}

      <AnswerArea
        correctWords={correctWords}
        onRemove={handleRemove}
        placedWords={placedWords}
        result={result}
      />

      <WordBank onPlace={handlePlace} placedWords={placedWords} words={wordBankOptions} />

      {result && <ResultAnnouncement isCorrect={result.result.isCorrect} />}

      {isIncorrect && (
        <p className="text-muted-foreground text-sm">
          {t("Correct answer: {answer}", { answer: correctSentence })}
        </p>
      )}
    </InteractiveStepLayout>
  );
}
