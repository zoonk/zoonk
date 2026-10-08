"use client";

import { parseStepContent } from "@zoonk/core/library/steps/contract";
import { type SerializedStep } from "@zoonk/core/player/contracts/prepare-lesson-data";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { useCallback, useMemo, useState } from "react";
import { type SelectedAnswer, type StepResult } from "../step-answer";
import { type BlankState, getCompletedUserAnswers } from "./_utils/fill-blank-state";
import { getTemplateRomanization } from "./_utils/template-romanization";
import { FillBlankWordBank } from "./fill-blank-word-bank";
import { InlineFeedback } from "./inline-feedback";
import { QuestionText } from "./question-text";
import { RomanizationText } from "./romanization-text";
import { InteractiveStepLayout } from "./step-layouts";

function getBlankResultState(
  index: number,
  blanks: (string | null)[],
  answers: string[],
): "correct" | "incorrect" | null {
  const userAnswer = blanks[index];

  if (!userAnswer) {
    return null;
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
  resultState: "correct" | "incorrect" | null;
  word: string | null;
}) {
  const t = useExtracted();
  const hasResult = Boolean(resultState);

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
          resultState === "correct" && "border-success/50 text-success",
          resultState === "incorrect" && "border-destructive/50 text-destructive",
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
              resultState={hasResult ? getBlankResultState(index, blanks, answers) : null}
              word={blanks[index] ?? null}
            />
          )}
        </span>
      ))}
    </p>
  );
}

export function FillBlankStep({
  onSelectAnswer,
  result,
  selectedAnswer,
  step,
}: {
  onSelectAnswer: (answer: SelectedAnswer | null) => void;
  result?: StepResult;
  selectedAnswer?: SelectedAnswer;
  step: SerializedStep;
}) {
  const content = useMemo(() => parseStepContent("fillBlank", step.content), [step.content]);
  const blankCount = content.answers.length;
  const hasResult = result !== undefined;

  const templateRomanization = useMemo(() => {
    const firstAnswer = content.answers[0] ?? "";
    const fullSentence = content.template.replace("[BLANK]", firstAnswer);
    const fullSentenceRomanization = content.romanizations?.[fullSentence];
    const answerRomanization = content.romanizations?.[firstAnswer];

    return getTemplateRomanization({
      answer: answerRomanization,
      sentence: fullSentenceRomanization,
    });
  }, [content.romanizations, content.answers, content.template]);

  const [blanks, setBlanks] = useState<BlankState>(() => {
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

      const userAnswers = getCompletedUserAnswers(next);

      if (userAnswers) {
        onSelectAnswer({ kind: "fillBlank", userAnswers });
      }
    },
    [blanks, onSelectAnswer],
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
        onSelectAnswer(null);
      }
    },
    [blanks, onSelectAnswer, selectedAnswer],
  );

  return (
    <InteractiveStepLayout>
      {content.question && <QuestionText>{content.question}</QuestionText>}

      <TemplateText
        answers={content.answers}
        blanks={blanks}
        hasResult={hasResult}
        onRemoveWord={handleRemoveWord}
        template={content.template}
      />

      <RomanizationText>{templateRomanization}</RomanizationText>

      <FillBlankWordBank
        blanks={blanks}
        disabled={hasResult}
        onPlaceWord={handlePlaceWord}
        options={step.fillBlankOptions}
      />

      {result && <InlineFeedback result={result} />}
    </InteractiveStepLayout>
  );
}
