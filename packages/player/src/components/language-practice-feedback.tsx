"use client";

import { parseStepContent } from "@zoonk/core/steps/content-contract";
import { cn } from "@zoonk/ui/lib/utils";
import { CircleCheck, CircleX } from "lucide-react";
import { useExtracted } from "next-intl";
import { type StepResult } from "../player-reducer";
import { type SerializedStep } from "../prepare-activity-data";
import { useReplaceName } from "../user-name-context";
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

function FeedbackMessage({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      className={cn("text-foreground max-w-md text-lg leading-relaxed", className)}
      data-slot="feedback-message"
      {...props}
    />
  );
}

function LanguageAnswerLine({
  audioUrl,
  label,
  romanization,
  text,
  translation,
  variant,
}: {
  audioUrl: string | null;
  label: string;
  romanization: string | null;
  text: string;
  translation: string;
  variant: "correct" | "incorrect";
}) {
  const icon =
    variant === "correct" ? (
      <CircleCheck aria-hidden="true" className="size-4" />
    ) : (
      <CircleX aria-hidden="true" className="size-4" />
    );

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
      <div className="flex flex-1 flex-col gap-0.5">
        <div className="flex items-center gap-2">
          <div>
            <span className="text-muted-foreground">{label}</span>{" "}
            <span className="font-medium">{text}</span>
          </div>
          {audioUrl && <PlayAudioButton audioUrl={audioUrl} size="xs" />}
        </div>
        <RomanizationText>{romanization}</RomanizationText>
        <span className="text-muted-foreground text-xs">{translation}</span>
      </div>
    </div>
  );
}

export function LanguagePracticeFeedback({
  result,
  step,
}: {
  result: StepResult;
  step: SerializedStep;
}) {
  const t = useExtracted();
  const replaceName = useReplaceName();
  const parsed = parseStepContent("multipleChoice", step.content);

  if (parsed.kind !== "language") {
    return null;
  }

  const content = parsed;
  const { isCorrect, feedback: rawFeedback } = result.result;
  const feedback = rawFeedback ? replaceName(rawFeedback) : null;

  const selectedIndex =
    result.answer?.kind === "multipleChoice" ? result.answer.selectedIndex : null;

  const selectedOption = selectedIndex === null ? null : content.options[selectedIndex];
  const correctOption = content.options.find((option) => option.isCorrect);

  return (
    <FeedbackScreen>
      <div className="flex flex-col gap-2">
        {isCorrect ? (
          correctOption && (
            <LanguageAnswerLine
              audioUrl={correctOption.audioUrl}
              label={t("Your answer:")}
              romanization={correctOption.textRomanization}
              text={correctOption.text}
              translation={correctOption.translation}
              variant="correct"
            />
          )
        ) : (
          <>
            {selectedOption && (
              <LanguageAnswerLine
                audioUrl={selectedOption.audioUrl}
                label={t("Your answer:")}
                romanization={selectedOption.textRomanization}
                text={selectedOption.text}
                translation={selectedOption.translation}
                variant="incorrect"
              />
            )}
            {correctOption && (
              <LanguageAnswerLine
                audioUrl={correctOption.audioUrl}
                label={t("Correct answer:")}
                romanization={correctOption.textRomanization}
                text={correctOption.text}
                translation={correctOption.translation}
                variant="correct"
              />
            )}
          </>
        )}
      </div>

      {feedback && <FeedbackMessage>{feedback}</FeedbackMessage>}

      <ResultAnnouncement isCorrect={isCorrect} />
    </FeedbackScreen>
  );
}
