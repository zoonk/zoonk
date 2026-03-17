"use client";

import { parseStepContent } from "@zoonk/core/steps/content-contract";
import { useExtracted } from "next-intl";
import { type StepResult } from "../player-reducer";
import { type SerializedStep } from "../prepare-activity-data";
import { useReplaceName } from "../user-name-context";
import { AnswerLine } from "./answer-line";
import { FeedbackMessage, FeedbackScreen } from "./feedback-layout";
import { PlayAudioButton } from "./play-audio-button";
import { ResultAnnouncement } from "./result-announcement";
import { RomanizationText } from "./romanization-text";

function LanguageAnswerExtras({
  romanization,
  translation,
}: {
  romanization: string | null;
  translation: string;
}) {
  return (
    <>
      <RomanizationText>{romanization}</RomanizationText>
      <span className="text-muted-foreground text-xs">{translation}</span>
    </>
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

  const { isCorrect, feedback: rawFeedback } = result.result;
  const feedback = rawFeedback ? replaceName(rawFeedback) : null;

  const selectedIndex =
    result.answer?.kind === "multipleChoice" ? result.answer.selectedIndex : null;

  const selectedOption = selectedIndex === null ? null : parsed.options[selectedIndex];
  const correctOption = parsed.options.find((option) => option.isCorrect);

  return (
    <FeedbackScreen>
      <div className="flex flex-col gap-2">
        {isCorrect ? (
          correctOption && (
            <AnswerLine
              action={
                correctOption.audioUrl && (
                  <PlayAudioButton audioUrl={correctOption.audioUrl} size="xs" />
                )
              }
              label={t("Your answer:")}
              text={correctOption.text}
              variant="correct"
            >
              <LanguageAnswerExtras
                romanization={correctOption.textRomanization}
                translation={correctOption.translation}
              />
            </AnswerLine>
          )
        ) : (
          <>
            {selectedOption && (
              <AnswerLine
                action={
                  selectedOption.audioUrl && (
                    <PlayAudioButton audioUrl={selectedOption.audioUrl} size="xs" />
                  )
                }
                label={t("Your answer:")}
                text={selectedOption.text}
                variant="incorrect"
              >
                <LanguageAnswerExtras
                  romanization={selectedOption.textRomanization}
                  translation={selectedOption.translation}
                />
              </AnswerLine>
            )}
            {correctOption && (
              <AnswerLine
                action={
                  correctOption.audioUrl && (
                    <PlayAudioButton audioUrl={correctOption.audioUrl} size="xs" />
                  )
                }
                label={t("Correct answer:")}
                text={correctOption.text}
                variant="correct"
              >
                <LanguageAnswerExtras
                  romanization={correctOption.textRomanization}
                  translation={correctOption.translation}
                />
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
