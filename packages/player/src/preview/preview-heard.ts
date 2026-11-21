import {
  type PlayableLanguageStep,
  type PlayableSpokenAnswerStep,
} from "@zoonk/core/lesson-player/playable-lesson";
import { type SerializedStep } from "@zoonk/core/player/contracts/prepare-lesson-data";
import { languageStep, spokenSentenceStep } from "./preview-steps";

/** A silent clip, so a preview's sentence plays the way a recorded one would. */
const SILENT_CLIP =
  "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=";

function withSentenceClip(exercise: SerializedStep): SerializedStep {
  return exercise.sentence
    ? { ...exercise, sentence: { ...exercise.sentence, audioUrl: SILENT_CLIP } }
    : exercise;
}

/** A listening screen whose sentence has its clip, as a lesson plays it. */
export function heardListeningStep(options: { id?: string } = {}): PlayableLanguageStep {
  const step = languageStep("listening", undefined, options);
  return { ...step, exercise: withSentenceClip(step.exercise) };
}

/** The spoken screen whose listening fallback has its clip, as a lesson plays it. */
export function heardSpokenSentenceStep(options: { id?: string } = {}): PlayableSpokenAnswerStep {
  const step = spokenSentenceStep(options);
  return { ...step, listening: step.listening && withSentenceClip(step.listening) };
}
