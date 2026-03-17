"use client";

import { type DragEndEvent } from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { Tooltip, TooltipContent, TooltipTrigger } from "@zoonk/ui/components/tooltip";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { useCallback, useRef, useState } from "react";
import { type SelectedAnswer, type StepResult } from "../player-reducer";
import { type WordBankOption } from "../prepare-activity-data";
import { useWordAudio } from "../use-word-audio";
import { ArrangeWordsAnswerArea, type PlacedWord } from "./arrange-words-answer-area";
import { ArrangeWordsFeedback, type ArrangeWordsFeedbackProps } from "./arrange-words-feedback";
import { InlineFeedback } from "./inline-feedback";
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
  feedbackDetails?: ArrangeWordsFeedbackProps;
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

  const handlePlace = useCallback(
    (option: WordBankOption) => {
      if (placedWords.length >= correctWords.length) {
        return;
      }

      play(option.audioUrl);
      const placed: PlacedWord = { ...option, id: String(idCounter.current) };
      idCounter.current += 1;
      const next = [...placedWords, placed];
      setPlacedWords(next);

      if (next.length === correctWords.length) {
        onSelectAnswer(stepId, {
          arrangedWords: next.map((pw) => pw.word),
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

      if (reordered.length === correctWords.length) {
        onSelectAnswer(stepId, {
          arrangedWords: reordered.map((pw) => pw.word),
          kind: answerKind,
        });
      }
    },
    [answerKind, correctWords.length, onSelectAnswer, placedWords, stepId],
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

      {result && (
        <InlineFeedback result={result}>
          {feedbackDetails && <ArrangeWordsFeedback {...feedbackDetails} />}
        </InlineFeedback>
      )}
    </InteractiveStepLayout>
  );
}
