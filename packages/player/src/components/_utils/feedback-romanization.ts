import { type SerializedStep } from "@zoonk/core/player/contracts/prepare-activity-data";
import { type StepResult } from "../../player-reducer";

/**
 * Returns romanization only when it differs from the displayed text.
 * Prevents showing duplicate text when romanization equals the sentence
 * (bad AI generation data where the original script was copied into
 * the romanization field instead of the Latin transliteration).
 */
function getVisibleRomanization({
  displayedText,
  romanization,
}: {
  displayedText: string;
  romanization?: string | null;
}): string | null {
  if (!romanization) {
    return null;
  }

  if (romanization.trim() === displayedText.trim()) {
    return null;
  }

  return romanization;
}

function getCorrectReadingRomanization({
  kind,
  romanizations,
  selectedText,
}: {
  kind?: string;
  selectedText: string | null;
  romanizations: {
    sentenceRomanization?: string | null;
    wordRomanization?: string | null;
  };
}): string | null {
  if (kind === "reading" && selectedText) {
    return getVisibleRomanization({
      displayedText: selectedText,
      romanization: romanizations.sentenceRomanization,
    });
  }

  if (kind === "translation" && selectedText) {
    return getVisibleRomanization({
      displayedText: selectedText,
      romanization: romanizations.wordRomanization,
    });
  }

  return null;
}

function getWrongReadingRomanization({
  correctAnswer,
  kind,
  romanizations,
}: {
  correctAnswer?: string | null;
  kind?: string;
  romanizations: {
    sentenceRomanization?: string | null;
    wordRomanization?: string | null;
  };
}): string | null {
  if (kind === "reading" && correctAnswer) {
    return getVisibleRomanization({
      displayedText: correctAnswer,
      romanization: romanizations.sentenceRomanization,
    });
  }

  if (kind === "translation" && correctAnswer) {
    return getVisibleRomanization({
      displayedText: correctAnswer,
      romanization: romanizations.wordRomanization,
    });
  }

  return null;
}

/**
 * Resolves which romanization texts to show on the feedback screen
 * based on the answer kind and dedup rules.
 *
 * Translation steps use word-level romanization (step.word.romanization),
 * while reading/listening steps use sentence-level romanization
 * (step.sentence.romanization). Both go through the same dedup logic
 * to prevent showing romanization that matches the displayed text
 * (bad AI data).
 */
export function getFeedbackRomanization({
  correctAnswer,
  questionText,
  result,
  selectedText,
  step,
}: {
  correctAnswer?: string | null;
  questionText: string | null;
  result: StepResult;
  selectedText: string | null;
  step?: SerializedStep;
}) {
  const sentenceRomanization = step?.sentence?.romanization;
  const wordRomanization = step?.word?.romanization;
  const kind = result.answer?.kind;

  return {
    /**
     * Romanization for the "Your answer:" line on correct answers.
     * Used by both reading (sentence romanization) and translation (word romanization).
     */
    correctReading: getCorrectReadingRomanization({
      kind,
      romanizations: {
        sentenceRomanization,
        wordRomanization,
      },
      selectedText,
    }),

    /** Romanization for the "Translate:" line — only for listening (shows target language sentence). */
    translate:
      kind === "listening"
        ? getVisibleRomanization({
            displayedText: questionText ?? "",
            romanization: sentenceRomanization,
          })
        : null,

    /**
     * Romanization for the "Correct answer:" line on wrong answers.
     * Used by both reading (sentence romanization) and translation (word romanization).
     */
    wrongReading: getWrongReadingRomanization({
      correctAnswer,
      kind,
      romanizations: {
        sentenceRomanization,
        wordRomanization,
      },
    }),
  };
}
