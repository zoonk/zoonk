import { type StepResult } from "../../player-reducer";
import { type SerializedStep } from "../../prepare-activity-data";

/**
 * Returns romanization only when it differs from the displayed text.
 * Prevents showing duplicate text when romanization equals the sentence
 * (bad AI generation data where the original script was copied into
 * the romanization field instead of the Latin transliteration).
 */
function getVisibleRomanization(
  romanization: string | null | undefined,
  displayedText: string,
): string | null {
  if (!romanization) {
    return null;
  }

  if (romanization.trim() === displayedText.trim()) {
    return null;
  }

  return romanization;
}

function getCorrectReadingRomanization(
  kind: string | undefined,
  selectedText: string | null,
  romanizations: {
    sentenceRomanization: string | null | undefined;
    wordRomanization: string | null | undefined;
  },
): string | null {
  if (kind === "reading" && selectedText) {
    return getVisibleRomanization(romanizations.sentenceRomanization, selectedText);
  }

  if (kind === "translation" && selectedText) {
    return getVisibleRomanization(romanizations.wordRomanization, selectedText);
  }

  return null;
}

function getWrongReadingRomanization(
  kind: string | undefined,
  correctAnswer: string | null | undefined,
  romanizations: {
    sentenceRomanization: string | null | undefined;
    wordRomanization: string | null | undefined;
  },
): string | null {
  if (kind === "reading" && correctAnswer) {
    return getVisibleRomanization(romanizations.sentenceRomanization, correctAnswer);
  }

  if (kind === "translation" && correctAnswer) {
    return getVisibleRomanization(romanizations.wordRomanization, correctAnswer);
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
export function getFeedbackRomanization(
  result: StepResult,
  step: SerializedStep | undefined,
  selectedText: string | null,
  correctAnswer: string | null | undefined,
  questionText: string | null,
) {
  const sentenceRomanization = step?.sentence?.romanization;
  const wordRomanization = step?.word?.romanization;
  const kind = result.answer?.kind;

  return {
    /**
     * Romanization for the "Your answer:" line on correct answers.
     * Used by both reading (sentence romanization) and translation (word romanization).
     */
    correctReading: getCorrectReadingRomanization(kind, selectedText, {
      sentenceRomanization,
      wordRomanization,
    }),

    /** Romanization for the "Translate:" line — only for listening (shows target language sentence). */
    translate:
      kind === "listening"
        ? getVisibleRomanization(sentenceRomanization, questionText ?? "")
        : null,

    /**
     * Romanization for the "Correct answer:" line on wrong answers.
     * Used by both reading (sentence romanization) and translation (word romanization).
     */
    wrongReading: getWrongReadingRomanization(kind, correctAnswer, {
      sentenceRomanization,
      wordRomanization,
    }),
  };
}
