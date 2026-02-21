"use client";

import { parseStepContent } from "@zoonk/core/steps/content-contract";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { useCallback, useMemo, useState } from "react";
import { type SelectedAnswer, type StepResult } from "../player-reducer";
import { type SerializedStep } from "../prepare-activity-data";
import { useReplaceName } from "../user-name-context";
import { InlineFeedback } from "./inline-feedback";
import { QuestionText } from "./question-text";
import { InteractiveStepLayout } from "./step-layouts";

function getBlankResultState(
  index: number,
  blanks: (string | null)[],
  answers: string[],
): "correct" | "incorrect" | undefined {
  const userAnswer = blanks[index];

  if (!userAnswer) {
    return undefined;
  }

  return userAnswer.toLowerCase() === answers[index]?.toLowerCase() ? "correct" : "incorrect";
}

function BlankSlot({
  index,
  onRemove,
  resultState,
  word,
}: {
  index: number;
  onRemove: () => void;
  resultState?: "correct" | "incorrect";
  word: string | null;
}) {
  const t = useExtracted();
  const hasResult = resultState !== undefined;

  if (word) {
    return (
      <button
        aria-label={
          hasResult
            ? t("Blank {position}: {item}. {result}.", {
                item: word,
                position: String(index + 1),
                result: resultState === "correct" ? t("Correct") : t("Incorrect"),
              })
            : t("Blank {position}: {item}. Tap to remove.", {
                item: word,
                position: String(index + 1),
              })
        }
        className={cn(
          "inline-flex min-w-16 items-center justify-center border-b-2 px-1 font-medium transition-all duration-150",
          hasResult && "pointer-events-none",
          !resultState && "border-primary/30 text-primary",
          resultState === "correct" && "border-success text-success",
          resultState === "incorrect" && "border-destructive text-destructive",
        )}
        disabled={hasResult}
        onClick={onRemove}
        type="button"
      >
        {word}
      </button>
    );
  }

  return (
    <span
      aria-label={t("Blank {position}", { position: String(index + 1) })}
      className="border-muted-foreground/30 inline-flex min-w-16 border-b-2"
      role="img"
    />
  );
}

function TemplateText({
  answers,
  blanks,
  hasResult,
  onRemoveWord,
  template,
}: {
  answers: string[];
  blanks: (string | null)[];
  hasResult: boolean;
  onRemoveWord: (blankIndex: number) => void;
  template: string;
}) {
  const segments = template.split("[BLANK]");

  return (
    <p className="text-base leading-10">
      {segments.map((segment, index) => (
        // oxlint-disable-next-line react/no-array-index-key -- Template segments from split() can repeat, no unique ID
        <span key={`seg-${segment}-${index}`}>
          {segment}

          {index < segments.length - 1 && (
            <BlankSlot
              index={index}
              onRemove={() => onRemoveWord(index)}
              resultState={hasResult ? getBlankResultState(index, blanks, answers) : undefined}
              word={blanks[index] ?? null}
            />
          )}
        </span>
      ))}
    </p>
  );
}

function WordTile({
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
          ? "pointer-events-none opacity-50"
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
  blanks,
  disabled,
  onPlaceWord,
  words,
}: {
  blanks: (string | null)[];
  disabled: boolean;
  onPlaceWord: (word: string) => void;
  words: string[];
}) {
  const t = useExtracted();
  const usedWords = blanks.filter(Boolean);

  return (
    <div
      aria-label={t("Word bank")}
      className={cn("flex flex-wrap gap-2.5", disabled && "pointer-events-none opacity-50")}
      role="group"
    >
      {words.map((word, index) => {
        const usedCount = usedWords.filter((used) => used === word).length;
        const totalCount = words.slice(0, index + 1).filter((item) => item === word).length;
        const isUsed = usedCount >= totalCount;

        return (
          <WordTile
            isUsed={isUsed}
            // oxlint-disable-next-line react/no-array-index-key -- Words can repeat in word bank, no unique ID
            key={`${word}-${index}`}
            onPlace={() => onPlaceWord(word)}
            word={word}
          />
        );
      })}
    </div>
  );
}

function getCorrectSentence(template: string, answers: string[]): string {
  return template
    .split("[BLANK]")
    .reduce((acc, segment, index) => acc + segment + (answers[index] ?? ""), "");
}

function isComplete(blanks: (string | null)[]): blanks is string[] {
  return blanks.every((blank) => blank !== null);
}

export function FillBlankStep({
  onSelectAnswer,
  result,
  selectedAnswer,
  step,
}: {
  onSelectAnswer: (stepId: string, answer: SelectedAnswer | null) => void;
  result?: StepResult;
  selectedAnswer: SelectedAnswer | undefined;
  step: SerializedStep;
}) {
  const t = useExtracted();
  const content = useMemo(() => parseStepContent("fillBlank", step.content), [step.content]);
  const replaceName = useReplaceName();
  const blankCount = content.answers.length;
  const hasResult = result !== undefined;

  const [blanks, setBlanks] = useState<(string | null)[]>(() => {
    if (result?.answer?.kind === "fillBlank") {
      return result.answer.userAnswers;
    }

    return Array.from({ length: blankCount }, () => null);
  });

  const handlePlaceWord = useCallback(
    (word: string) => {
      const firstEmptyIndex = blanks.indexOf(null);

      if (firstEmptyIndex === -1) {
        return;
      }

      const next = [...blanks];
      next[firstEmptyIndex] = word;
      setBlanks(next);

      if (isComplete(next)) {
        onSelectAnswer(step.id, { kind: "fillBlank", userAnswers: next });
      }
    },
    [blanks, onSelectAnswer, step.id],
  );

  const handleRemoveWord = useCallback(
    (blankIndex: number) => {
      if (!blanks[blankIndex]) {
        return;
      }

      const next = [...blanks];
      next[blankIndex] = null;
      setBlanks(next);

      if (selectedAnswer) {
        onSelectAnswer(step.id, null);
      }
    },
    [blanks, onSelectAnswer, selectedAnswer, step.id],
  );

  const isIncorrect = result && !result.result.isCorrect;

  return (
    <InteractiveStepLayout>
      {content.question && <QuestionText>{replaceName(content.question)}</QuestionText>}

      <TemplateText
        answers={content.answers}
        blanks={blanks}
        hasResult={hasResult}
        onRemoveWord={handleRemoveWord}
        template={content.template}
      />

      <WordBank
        blanks={blanks}
        disabled={hasResult}
        onPlaceWord={handlePlaceWord}
        words={step.fillBlankOptions}
      />

      {result && (
        <InlineFeedback result={result}>
          {isIncorrect && (
            <p className="text-muted-foreground text-sm">
              {t("Correct answer: {answer}", {
                answer: getCorrectSentence(content.template, content.answers),
              })}
            </p>
          )}
        </InlineFeedback>
      )}
    </InteractiveStepLayout>
  );
}
