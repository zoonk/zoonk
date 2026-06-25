"use client";

import { type SerializedStep } from "@zoonk/core/player/contracts/prepare-lesson-data";
import { parseStepContent } from "@zoonk/core/steps/contract/content";
import { useExtracted } from "next-intl";
import { type StepResult } from "../player-reducer";
import { getFeedbackRomanization } from "./_utils/feedback-romanization";
import { CorrectAnswerBlock, IncorrectAnswerBlock } from "./feedback-answer-blocks";
import { PlayAudioButton } from "./play-audio-button";
import { PlayerFeedbackScene, PlayerFeedbackSceneMessage } from "./player-feedback-scene";
import { PlayerRichText } from "./player-rich-text";
import { PlayerSupportingText } from "./player-supporting-text";
import { RomanizationText } from "./romanization-text";
import { SectionLabel } from "./section-label";

type FeedbackPromptReviewContent = { context: string | null; question: string | null };

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
 * lessons. The selected display text comes from the serialized option pool.
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
 * Dedicated multiple-choice feedback replaces the original prompt, so missed
 * answers need a small copy-only reminder of the context the learner just used.
 * Inline feedback step kinds keep their prompt on screen and do not need this.
 */
function getMultipleChoicePromptReview({
  result,
  step,
}: {
  result: StepResult;
  step?: SerializedStep;
}): FeedbackPromptReviewContent | null {
  if (
    result.result.isCorrect ||
    result.answer?.kind !== "multipleChoice" ||
    step?.kind !== "multipleChoice"
  ) {
    return null;
  }

  const content = parseStepContent("multipleChoice", step.content);
  const promptReview = { context: content.context ?? null, question: content.question ?? null };

  if (!promptReview.context && !promptReview.question) {
    return null;
  }

  return promptReview;
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
 * Shows the original missed prompt with quieter typography than the answer
 * rows. It gives learners enough context to understand the correction without
 * turning the feedback scene back into the full question screen.
 */
function FeedbackPromptReview({ prompt }: { prompt: FeedbackPromptReviewContent }) {
  const t = useExtracted();

  return (
    <div
      className="flex flex-col gap-1.5 text-sm leading-relaxed"
      data-slot="feedback-prompt-review"
    >
      <SectionLabel>{t("Question")}</SectionLabel>

      {prompt.context && (
        <p className="text-muted-foreground">
          <PlayerRichText text={prompt.context} />
        </p>
      )}

      {prompt.question && (
        <p className="text-foreground font-medium">
          <PlayerRichText text={prompt.question} />
        </p>
      )}
    </div>
  );
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
  const { isCorrect, feedback, correctAnswer } = result.result;
  const selectedText = getSelectedText(result, step);
  const questionText = getQuestionText(result, step);
  const promptReview = getMultipleChoicePromptReview({ result, step });
  const rom = getFeedbackRomanization({ correctAnswer, questionText, result, selectedText, step });
  const audioUrl = getFeedbackAudioUrl(step);

  return (
    <PlayerFeedbackScene>
      <div className="flex flex-col gap-3">
        {promptReview && <FeedbackPromptReview prompt={promptReview} />}

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
