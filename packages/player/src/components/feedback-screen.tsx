"use client";

import { type SerializedStep } from "@zoonk/core/player/contracts/prepare-activity-data";
import { parseStepContent } from "@zoonk/core/steps/contract/content";
import { useExtracted } from "next-intl";
import { type StepResult } from "../player-reducer";
import { useReplaceName } from "../user-name-context";
import { getFeedbackRomanization } from "./_utils/feedback-romanization";
import { CorrectAnswerBlock, IncorrectAnswerBlock } from "./feedback-answer-blocks";
import { PlayAudioButton } from "./play-audio-button";
import { PlayerFeedbackScene, PlayerFeedbackSceneMessage } from "./player-feedback-scene";
import { PlayerSupportingText } from "./player-supporting-text";
import { RomanizationText } from "./romanization-text";

function getArrangeWordsSelectedText(result: StepResult): string | null {
  if (result.answer?.kind === "reading" || result.answer?.kind === "listening") {
    return result.answer.arrangedWords.join(" ");
  }

  return null;
}

/**
 * Multiple-choice submissions store the option ID so shuffled options validate
 * against the canonical content. The feedback screen still displays learner
 * text, so it derives that text from the step content at render time.
 */
function getMultipleChoiceSelectedText(result: StepResult, step?: SerializedStep): string | null {
  if (result.answer?.kind !== "multipleChoice" || step?.kind !== "multipleChoice") {
    return null;
  }

  const { selectedOptionId } = result.answer;
  const content = parseStepContent("multipleChoice", step.content);
  return content.options.find((option) => option.id === selectedOptionId)?.text ?? null;
}

/**
 * Translation answers use the same selectedOptionId shape as other option
 * activities. The selected display text comes from the serialized option pool.
 */
function getTranslationSelectedText(result: StepResult, step?: SerializedStep): string | null {
  if (result.answer?.kind !== "translation") {
    return null;
  }

  const { selectedOptionId } = result.answer;
  return step?.translationOptions.find((option) => option.id === selectedOptionId)?.word ?? null;
}

function getSelectedText(result: StepResult, step?: SerializedStep): string | null {
  if (result.answer?.kind === "multipleChoice") {
    return getMultipleChoiceSelectedText(result, step);
  }

  if (result.answer?.kind === "translation") {
    return getTranslationSelectedText(result, step);
  }

  return getArrangeWordsSelectedText(result);
}

function getQuestionText(result: StepResult, step?: SerializedStep): string | null {
  if (result.answer?.kind === "translation") {
    return step?.word?.translation ?? null;
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

/**
 * Renders answer feedback for steps that collect a binary correct/incorrect
 * result. The feedback layout lives here so every checked step uses the same
 * answer summary, optional pronunciation audio, and written feedback treatment.
 */
export function FeedbackScreenContent({
  result,
  step,
}: {
  result: StepResult;
  step?: SerializedStep;
}) {
  const t = useExtracted();
  const replaceName = useReplaceName();
  const { isCorrect, feedback: rawFeedback, correctAnswer } = result.result;
  const feedback = rawFeedback ? replaceName(rawFeedback) : null;
  const selectedText = getSelectedText(result, step);
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
