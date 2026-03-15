"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { CircleAlert, CircleCheck, CircleX, TriangleAlert } from "lucide-react";
import { useExtracted } from "next-intl";
import { type DimensionInventory, type StepResult } from "../player-reducer";
import { useReplaceName } from "../user-name-context";
import {
  type DimensionEntry,
  DimensionList,
  STAGGER_WARNING_EXTRA_MS,
  buildDimensionEntries,
  getWarningDelay,
} from "./dimension-inventory";
import { ResultAnnouncement } from "./result-announcement";

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
            <AnswerLine
              icon={<CircleCheck aria-hidden="true" className="size-4" />}
              label={t("Your answer:")}
              variant="correct"
            >
              {selectedText}
            </AnswerLine>
          )
        ) : (
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
                {correctAnswer}
              </AnswerLine>
            )}
          </>
        )}
      </div>

      {feedback && <FeedbackMessage>{feedback}</FeedbackMessage>}

      <ResultAnnouncement isCorrect={isCorrect} />
    </FeedbackScreen>
  );
}

export function FeedbackScreenContent({
  dimensions,
  result,
}: {
  dimensions?: DimensionInventory;
  result: StepResult;
}) {
  const hasEffects = result.effects.length > 0;

  if (hasEffects && dimensions) {
    return <ChallengeFeedback dimensions={dimensions} result={result} />;
  }

  return <CoreFeedback result={result} />;
}
