"use client";

import { type SerializedStep } from "@zoonk/core/player/contracts/prepare-activity-data";
import { useExtracted } from "next-intl";
import { type StepResult } from "../player-reducer";
import { useReplaceName } from "../user-name-context";
import { getFeedbackRomanization } from "./_utils/feedback-romanization";
import { CorrectAnswerBlock, IncorrectAnswerBlock } from "./feedback-answer-blocks";
import { InvestigationCallFeedbackContent } from "./investigation-call-feedback";
import { PlayAudioButton } from "./play-audio-button";
import { PlayerFeedbackScene, PlayerFeedbackSceneMessage } from "./player-feedback-scene";
import { PlayerSupportingText } from "./player-supporting-text";
import { RomanizationText } from "./romanization-text";
import { StoryFeedbackContent } from "./story-feedback-content";

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
  const rom = getFeedbackRomanization({
    correctAnswer,
    questionText,
    result,
    selectedText,
    step,
  });
  const audioUrl = getFeedbackAudioUrl(step);

  return (
    <PlayerFeedbackScene>
      <div className="flex flex-col gap-2">
        {questionText && (
          <div className="flex flex-col gap-1">
            <PlayerSupportingText>
              {t("Translate:")} <span className="text-foreground font-medium">{questionText}</span>
            </PlayerSupportingText>
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

      {feedback && <PlayerFeedbackSceneMessage>{feedback}</PlayerFeedbackSceneMessage>}
    </PlayerFeedbackScene>
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
