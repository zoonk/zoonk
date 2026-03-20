"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { CircleAlert, TriangleAlert } from "lucide-react";
import { useExtracted } from "next-intl";
import { type DimensionInventory, type StepResult } from "../player-reducer";
import { type SerializedStep } from "../prepare-activity-data";
import { useReplaceName } from "../user-name-context";
import {
  type DimensionEntry,
  DimensionList,
  STAGGER_WARNING_EXTRA_MS,
  buildDimensionEntries,
  getWarningDelay,
} from "./dimension-inventory";
import {
  CorrectAnswerBlock,
  IncorrectAnswerBlock,
  getFeedbackRomanization,
} from "./feedback-answer-blocks";
import { PlayAudioButton } from "./play-audio-button";
import { ResultAnnouncement } from "./result-announcement";
import { RomanizationText } from "./romanization-text";

function FeedbackScreen({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      aria-live="polite"
      className={cn(
        "animate-in fade-in slide-in-from-bottom-1 mx-auto flex w-full max-w-lg flex-col gap-6 duration-200 ease-out motion-reduce:animate-none",
        className,
      )}
      data-slot="feedback-screen"
      role="status"
      {...props}
    />
  );
}

function FeedbackIndicator({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex items-center gap-1.5 text-sm font-medium", className)}
      data-slot="feedback-indicator"
      {...props}
    />
  );
}

function FeedbackMessage({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      className={cn("text-foreground max-w-md text-lg leading-relaxed", className)}
      data-slot="feedback-message"
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

function getArrangeWordsSelectedText(result: StepResult): string | null {
  if (result.answer?.kind === "reading" || result.answer?.kind === "listening") {
    return result.answer.arrangedWords.join(" ");
  }

  return null;
}

function getQuestionText(result: StepResult, step?: SerializedStep): string | null {
  if (result.answer?.kind === "translation") {
    return result.answer.questionText;
  }

  if (result.answer?.kind === "reading" && step?.sentence) {
    return step.sentence.translation;
  }

  if (result.answer?.kind === "listening" && step?.sentence) {
    return step.sentence.sentence;
  }

  return null;
}

function CoreFeedback({ result, step }: { result: StepResult; step?: SerializedStep }) {
  const t = useExtracted();
  const replaceName = useReplaceName();
  const { isCorrect, feedback: rawFeedback, correctAnswer } = result.result;
  const feedback = rawFeedback ? replaceName(rawFeedback) : null;
  const selectedText =
    result.answer?.kind === "multipleChoice" || result.answer?.kind === "translation"
      ? result.answer.selectedText
      : getArrangeWordsSelectedText(result);
  const questionText = getQuestionText(result, step);
  const rom = getFeedbackRomanization(result, step, selectedText, correctAnswer, questionText);

  return (
    <FeedbackScreen>
      <div className="flex flex-col gap-2">
        {questionText && (
          <div className="text-muted-foreground text-sm">
            <p>
              {t("Translate:")} <span className="text-foreground font-medium">{questionText}</span>
            </p>
            <RomanizationText>{rom.translate}</RomanizationText>
          </div>
        )}

        {isCorrect ? (
          selectedText && (
            <CorrectAnswerBlock romanization={rom.correctReading} selectedText={selectedText} />
          )
        ) : (
          <IncorrectAnswerBlock
            correctAnswer={correctAnswer}
            romanization={rom.wrongReading}
            selectedText={selectedText}
          />
        )}
      </div>

      {step?.sentence?.audioUrl && (
        <PlayAudioButton audioUrl={step.sentence.audioUrl} preload={false} variant="text" />
      )}

      {feedback && <FeedbackMessage>{feedback}</FeedbackMessage>}

      <ResultAnnouncement isCorrect={isCorrect} />
    </FeedbackScreen>
  );
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

  return <CoreFeedback result={result} step={step} />;
}
