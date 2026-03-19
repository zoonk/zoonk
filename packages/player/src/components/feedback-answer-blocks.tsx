"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { CircleCheck, CircleX } from "lucide-react";
import { useExtracted } from "next-intl";
import { type StepResult } from "../player-reducer";
import { type SerializedStep } from "../prepare-activity-data";
import { RomanizationText } from "./romanization-text";

/**
 * Returns romanization only when it differs from the displayed text.
 * Prevents showing duplicate text when romanization equals the sentence
 * (bad AI generation data where the original script was copied into
 * the romanization field instead of the Latin transliteration).
 */
function getVisibleRomanization(
  romanization: string | null | undefined,
  displayedText: string,
): string | null {
  if (!romanization) {
    return null;
  }

  if (romanization.trim() === displayedText.trim()) {
    return null;
  }

  return romanization;
}

/** Resolves which romanization texts to show based on the answer kind and dedup rules. */
export function getFeedbackRomanization(
  result: StepResult,
  step: SerializedStep | undefined,
  selectedText: string | null,
  correctAnswer: string | null | undefined,
  questionText: string | null,
) {
  const romanization = step?.sentence?.romanization;
  const kind = result.answer?.kind;

  return {
    /** Romanization for the "Your answer:" line on correct reading answers. */
    correctReading:
      kind === "reading" && selectedText
        ? getVisibleRomanization(romanization, selectedText)
        : null,

    /** Romanization for the "Translate:" line — only for listening (shows target language sentence). */
    translate:
      kind === "listening" ? getVisibleRomanization(romanization, questionText ?? "") : null,

    /** Romanization for the "Correct answer:" line on wrong reading answers. */
    wrongReading:
      kind === "reading" && correctAnswer
        ? getVisibleRomanization(romanization, correctAnswer)
        : null,
  };
}

function AnswerLine({
  children,
  icon,
  label,
  variant,
}: {
  children: React.ReactNode;
  icon: React.ReactNode;
  label: string;
  variant: "correct" | "incorrect";
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-lg px-3 py-2 text-sm",
        variant === "correct" ? "bg-success/10" : "bg-destructive/10",
      )}
    >
      <span
        className={cn(
          "mt-0.5 shrink-0",
          variant === "correct" ? "text-success" : "text-destructive",
        )}
      >
        {icon}
      </span>
      <div>
        <span className="text-muted-foreground">{label}</span>{" "}
        <span className="font-medium">{children}</span>
      </div>
    </div>
  );
}

export function CorrectAnswerBlock({
  romanization,
  selectedText,
}: {
  romanization: string | null;
  selectedText: string;
}) {
  const t = useExtracted();

  return (
    <AnswerLine
      icon={<CircleCheck aria-hidden="true" className="size-4" />}
      label={t("Your answer:")}
      variant="correct"
    >
      <span className="flex flex-col">
        <span>{selectedText}</span>
        <RomanizationText>{romanization}</RomanizationText>
      </span>
    </AnswerLine>
  );
}

export function IncorrectAnswerBlock({
  correctAnswer,
  romanization,
  selectedText,
}: {
  correctAnswer: string | null | undefined;
  romanization: string | null;
  selectedText: string | null;
}) {
  const t = useExtracted();

  return (
    <>
      {selectedText && (
        <AnswerLine
          icon={<CircleX aria-hidden="true" className="size-4" />}
          label={t("Your answer:")}
          variant="incorrect"
        >
          {selectedText}
        </AnswerLine>
      )}
      {correctAnswer && (
        <AnswerLine
          icon={<CircleCheck aria-hidden="true" className="size-4" />}
          label={t("Correct answer:")}
          variant="correct"
        >
          <span className="flex flex-col">
            <span>{correctAnswer}</span>
            <RomanizationText>{romanization}</RomanizationText>
          </span>
        </AnswerLine>
      )}
    </>
  );
}
