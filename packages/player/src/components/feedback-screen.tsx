"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { type StepResult } from "../player-reducer";
import { type SerializedStep } from "../prepare-activity-data";
import { useReplaceName } from "../user-name-context";
import { getFeedbackRomanization } from "./_utils/feedback-romanization";
import { CorrectAnswerBlock, IncorrectAnswerBlock } from "./feedback-answer-blocks";
import { InvestigationCallFeedbackContent } from "./investigation-call-feedback";
import { PlayAudioButton } from "./play-audio-button";
import { RomanizationText } from "./romanization-text";
import { StoryFeedbackContent } from "./story-feedback-content";

function FeedbackScreen({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      aria-live="polite"
      className={cn(
        "animate-in fade-in slide-in-from-bottom-1 mx-auto my-auto flex w-full max-w-lg flex-col gap-6 duration-200 ease-out motion-reduce:animate-none",
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

/**
 * Returns the audio URL for the feedback screen's pronunciation button.
 * Reading/listening steps use sentence audio; translation steps use word audio.
 */
function getFeedbackAudioUrl(step?: SerializedStep): string | null {
  if (step?.sentence?.audioUrl) {
    return step.sentence.audioUrl;
  }

  if (step?.word?.audioUrl) {
    return step.word.audioUrl;
  }

  return null;
}

function StandardFeedbackContent({ result, step }: { result: StepResult; step?: SerializedStep }) {
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
  const audioUrl = getFeedbackAudioUrl(step);

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

      {audioUrl && <PlayAudioButton audioUrl={audioUrl} preload={false} variant="text" />}

      {feedback && <FeedbackMessage>{feedback}</FeedbackMessage>}
    </FeedbackScreen>
  );
}

export function FeedbackScreenContent({
  result,
  step,
}: {
  result: StepResult;
  step?: SerializedStep;
}) {
  if (result.answer?.kind === "story") {
    return <StoryFeedbackContent result={result} step={step} />;
  }

  if (result.answer?.kind === "investigation" && result.answer.variant === "call") {
    return <InvestigationCallFeedbackContent result={result} step={step} />;
  }

  return <StandardFeedbackContent result={result} step={step} />;
}
