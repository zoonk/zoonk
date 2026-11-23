import {
  type PlayableLanguageStep,
  type PlayableSpokenAnswerStep,
} from "@zoonk/core/lesson-player/playable-lesson";
import { type SerializedStep } from "@zoonk/core/player/contracts/prepare-lesson-data";
import { languageStep, spokenSentenceStep } from "./preview-steps";

/** A silent clip, so a preview's sentence plays the way a recorded one would. */
const SILENT_CLIP =
  "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=";

/** Its sentence gets the clip, and its word bank one order, so the preview looks the same on every load. */
function asHeard(exercise: SerializedStep): SerializedStep {
  const wordBankOptions = exercise.wordBankOptions.toSorted((a, b) => a.word.localeCompare(b.word));
  const sentence = exercise.sentence && { ...exercise.sentence, audioUrl: SILENT_CLIP };

  return { ...exercise, sentence, wordBankOptions };
}

/** A listening screen whose sentence has its clip, as a lesson plays it. */
export function heardListeningStep(options: { id?: string } = {}): PlayableLanguageStep {
  const step = languageStep("listening", undefined, options);
  return { ...step, exercise: asHeard(step.exercise) };
}

/** The spoken screen whose listening fallback has its clip, as a lesson plays it. */
export function heardSpokenSentenceStep(options: { id?: string } = {}): PlayableSpokenAnswerStep {
  const step = spokenSentenceStep(options);
  return { ...step, listening: step.listening && asHeard(step.listening) };
}
