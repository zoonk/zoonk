"use client";

import { parseStepContent } from "@zoonk/core/steps/content-contract";
import { cn } from "@zoonk/ui/lib/utils";
import { CircleAlert, TriangleAlert } from "lucide-react";
import { useExtracted } from "next-intl";
import { type DimensionInventory, type StepResult } from "../player-reducer";
import { type SerializedStep } from "../prepare-activity-data";
import { useReplaceName } from "../user-name-context";
import { AnswerLine } from "./answer-line";
import {
  type DimensionEntry,
  DimensionList,
  STAGGER_WARNING_EXTRA_MS,
  buildDimensionEntries,
  getWarningDelay,
} from "./dimension-inventory";
import { FeedbackMessage, FeedbackScreen } from "./feedback-layout";
import { LanguagePracticeFeedback } from "./language-practice-feedback";
import { ResultAnnouncement } from "./result-announcement";

function FeedbackIndicator({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex items-center gap-1.5 text-sm font-medium", className)}
      data-slot="feedback-indicator"
      {...props}
    />
  );
}

function DimensionWarnings({
  entries,
  staggerDelay,
}: {
  entries: DimensionEntry[];
  staggerDelay: number;
}) {
  const t = useExtracted();
  const negative = entries.filter((entry) => entry.total < 0);
  const atZero = entries.filter((entry) => entry.total === 0 && entry.delta < 0);
  const hasCloseCall = atZero.length > 0 && negative.length === 0;

  if (negative.length === 0 && atZero.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-1.5">
      {negative.map((entry) => (
        <p
          className="text-destructive animate-in fade-in fill-mode-backwards flex items-center gap-1.5 text-sm font-semibold duration-200 motion-reduce:animate-none"
          key={entry.name}
          style={{ animationDelay: `${staggerDelay}ms` }}
        >
          <CircleAlert aria-hidden className="size-4 shrink-0" />
          {t("{name} is negative. You need to bring this back up or you will lose.", {
            name: entry.name,
          })}
        </p>
      ))}

      {atZero.map((entry) => (
        <p
          className="text-warning animate-in fade-in fill-mode-backwards flex items-center gap-1.5 text-sm font-medium duration-200 motion-reduce:animate-none"
          key={entry.name}
          style={{ animationDelay: `${staggerDelay}ms` }}
        >
          <TriangleAlert aria-hidden className="size-4 shrink-0" />
          {t("{name} is at zero. One more drop and you lose.", { name: entry.name })}
        </p>
      ))}

      {hasCloseCall && (
        <p
          className="text-warning animate-in fade-in fill-mode-backwards text-sm font-medium duration-300 motion-reduce:animate-none"
          style={{ animationDelay: `${staggerDelay + STAGGER_WARNING_EXTRA_MS}ms` }}
        >
          {t("Close call.")}
        </p>
      )}
    </div>
  );
}

function ChallengeFeedback({
  dimensions,
  result,
}: {
  dimensions: DimensionInventory;
  result: StepResult;
}) {
  const t = useExtracted();
  const replaceName = useReplaceName();
  const feedback = result.result.feedback ? replaceName(result.result.feedback) : null;
  const entries = buildDimensionEntries(dimensions, result.effects);
  const warningDelay = getWarningDelay(entries.length);

  return (
    <FeedbackScreen>
      <FeedbackIndicator className="text-foreground">{t("Outcome")}</FeedbackIndicator>

      {feedback && <FeedbackMessage>{feedback}</FeedbackMessage>}

      <DimensionList
        aria-label={t("Score changes")}
        entries={entries}
        staggered
        variant="feedback"
      />

      <DimensionWarnings entries={entries} staggerDelay={warningDelay} />
    </FeedbackScreen>
  );
}

function CoreFeedback({ result }: { result: StepResult }) {
  const t = useExtracted();
  const replaceName = useReplaceName();
  const { isCorrect, feedback: rawFeedback, correctAnswer } = result.result;
  const feedback = rawFeedback ? replaceName(rawFeedback) : null;
  const selectedText =
    result.answer?.kind === "multipleChoice" || result.answer?.kind === "translation"
      ? result.answer.selectedText
      : null;
  const questionText = result.answer?.kind === "translation" ? result.answer.questionText : null;

  return (
    <FeedbackScreen>
      <div className="flex flex-col gap-2">
        {questionText && (
          <p className="text-muted-foreground text-sm">
            {t("Translate:")} <span className="text-foreground font-medium">{questionText}</span>
          </p>
        )}

        {isCorrect ? (
          selectedText && (
            <AnswerLine label={t("Your answer:")} text={selectedText} variant="correct" />
          )
        ) : (
          <>
            {selectedText && (
              <AnswerLine label={t("Your answer:")} text={selectedText} variant="incorrect" />
            )}
            {correctAnswer && (
              <AnswerLine label={t("Correct answer:")} text={correctAnswer} variant="correct" />
            )}
          </>
        )}
      </div>

      {feedback && <FeedbackMessage>{feedback}</FeedbackMessage>}

      <ResultAnnouncement isCorrect={isCorrect} />
    </FeedbackScreen>
  );
}

function isLanguageMultipleChoice(step: SerializedStep | undefined): boolean {
  if (!step || step.kind !== "multipleChoice") {
    return false;
  }

  const content = parseStepContent("multipleChoice", step.content);
  return content.kind === "language";
}

export function FeedbackScreenContent({
  dimensions,
  result,
  step,
}: {
  dimensions?: DimensionInventory;
  result: StepResult;
  step?: SerializedStep;
}) {
  const hasEffects = result.effects.length > 0;

  if (hasEffects && dimensions) {
    return <ChallengeFeedback dimensions={dimensions} result={result} />;
  }

  if (step && isLanguageMultipleChoice(step)) {
    return <LanguagePracticeFeedback result={result} step={step} />;
  }

  return <CoreFeedback result={result} />;
}
