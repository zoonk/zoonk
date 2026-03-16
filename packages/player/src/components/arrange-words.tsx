"use client";

import { Tooltip, TooltipContent, TooltipTrigger } from "@zoonk/ui/components/tooltip";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { useCallback, useState } from "react";
import { type SelectedAnswer, type StepResult } from "../player-reducer";
import { type WordBankOption } from "../prepare-activity-data";
import { useWordAudio } from "../use-word-audio";
import { ArrangeWordsFeedback } from "./arrange-words-feedback";
import { InlineFeedback } from "./inline-feedback";
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
  option,
  position,
  resultState,
}: {
  onClick: () => void;
  option: WordBankOption;
  position: number;
  resultState?: "correct" | "incorrect";
}) {
  const t = useExtracted();
  const hasResult = resultState !== undefined;

  const ariaLabel = (() => {
    if (hasResult) {
      const result = resultState === "correct" ? t("Correct") : t("Incorrect");
      return t("{item}. {result}.", { item: option.word, result });
    }

    return t("Position {position}: {item}. Tap to remove.", {
      item: option.word,
      position: String(position + 1),
    });
  })();

  return (
    <button
      aria-label={ariaLabel}
      className={cn(
        "border-border flex min-h-11 flex-col items-center rounded-lg border px-4 py-2.5 text-base transition-all duration-150",
        hasResult && "pointer-events-none",
        !hasResult &&
          "hover:bg-accent focus-visible:border-ring focus-visible:ring-ring/50 outline-none focus-visible:ring-[3px]",
        resultState === "correct" && "bg-success/5 text-success border-transparent opacity-75",
        resultState === "incorrect" &&
          "bg-destructive/5 text-destructive border-transparent opacity-75",
      )}
      disabled={hasResult}
      onClick={onClick}
      type="button"
    >
      <span>{option.word}</span>

      {option.romanization && (
        <span className="text-muted-foreground text-xs">{option.romanization}</span>
      )}
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
  placedWords: WordBankOption[];
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
        placedWords.map((option, index) => (
          <PlacedWordTile
            // oxlint-disable-next-line react/no-array-index-key -- Words can repeat, no unique ID
            key={`placed-${option.word}-${index}`}
            onClick={() => onRemove(index)}
            option={option}
            position={index}
            resultState={result ? getWordResultState(option.word, index, correctWords) : undefined}
          />
        ))
      )}
    </div>
  );
}

function BankTileContent({ option }: { option: WordBankOption }) {
  return (
    <>
      <span>{option.word}</span>

      {option.romanization && (
        <span className="text-muted-foreground text-xs">{option.romanization}</span>
      )}
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
  const buttonClassName = cn(
    "border-border flex min-h-11 flex-col items-center rounded-lg border px-4 py-2.5 transition-all duration-150",
    isUsed
      ? "pointer-events-none opacity-30"
      : "hover:bg-accent focus-visible:border-ring focus-visible:ring-ring/50 outline-none focus-visible:ring-[3px]",
  );

  if (option.translation) {
    return (
      <Tooltip>
        <TooltipTrigger
          aria-disabled={isUsed}
          className={buttonClassName}
          onClick={onPlace}
          tabIndex={isUsed ? -1 : 0}
        >
          <BankTileContent option={option} />
        </TooltipTrigger>
        <TooltipContent>{option.translation}</TooltipContent>
      </Tooltip>
    );
  }

  return (
    <button
      aria-disabled={isUsed}
      className={buttonClassName}
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
  answerKind,
  children,
  correctWords,
  feedbackDetails,
  onSelectAnswer,
  result,
  selectedAnswer,
  stepId,
  wordBankOptions,
}: {
  answerKind: "reading" | "listening";
  children: React.ReactNode;
  correctWords: string[];
  feedbackDetails?: { sentence: string; translation: string };
  onSelectAnswer: (stepId: string, answer: SelectedAnswer | null) => void;
  result?: StepResult;
  selectedAnswer: SelectedAnswer | undefined;
  stepId: string;
  wordBankOptions: WordBankOption[];
}) {
  const [placedWords, setPlacedWords] = useState<WordBankOption[]>(() => {
    if (result?.answer?.kind === answerKind && "arrangedWords" in result.answer) {
      return result.answer.arrangedWords.map((word) => ({
        audioUrl: null,
        romanization: null,
        translation: null,
        word,
      }));
    }

    return [];
  });

  const { play } = useWordAudio();

  const handlePlace = useCallback(
    (option: WordBankOption) => {
      if (placedWords.length >= correctWords.length) {
        return;
      }

      play(option.audioUrl);
      const next = [...placedWords, option];
      setPlacedWords(next);

      if (next.length === correctWords.length) {
        onSelectAnswer(stepId, {
          arrangedWords: next.map((placed) => placed.word),
          kind: answerKind,
        });
      }
    },
    [answerKind, correctWords.length, onSelectAnswer, placedWords, play, stepId],
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

      {result && (
        <InlineFeedback result={result}>
          {feedbackDetails && (
            <ArrangeWordsFeedback
              correctWords={correctWords}
              translation={feedbackDetails.translation}
              wordBankOptions={wordBankOptions}
            />
          )}
        </InlineFeedback>
      )}
    </InteractiveStepLayout>
  );
}
