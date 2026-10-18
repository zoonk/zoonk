import { type StepKind } from "@zoonk/db";

/**
 * Kinds of practice a language plan can leave out and bring back anytime ("I don't need
 * writing"). Reading stays: every other activity builds on it.
 */
export const LANGUAGE_ACTIVITY_TYPES = ["vocabulary", "listening", "writing", "speaking"] as const;

export type LanguageActivityType = (typeof LANGUAGE_ACTIVITY_TYPES)[number];

/** The lesson screens each activity type is made of. */
const ACTIVITY_STEP_KINDS: Readonly<Record<LanguageActivityType, readonly StepKind[]>> = {
  listening: ["listening"],
  speaking: ["spokenAnswer"],
  vocabulary: ["vocabulary", "translation"],
  writing: ["typedAnswer"],
};

/** The screen kinds the learner's skipped activities leave out. */
function getSkippedStepKinds(activities: readonly LanguageActivityType[]): Set<StepKind> {
  return new Set(activities.flatMap((activity) => ACTIVITY_STEP_KINDS[activity]));
}

/**
 * A language lesson without the screens of the activities the learner skipped. A lesson that
 * would be left with nothing to do keeps all its screens, so skipping never empties a lesson.
 */
export function filterSkippedSteps<TStep extends { kind: StepKind }>({
  activities,
  steps,
}: {
  activities: readonly LanguageActivityType[];
  steps: readonly TStep[];
}): TStep[] {
  const skipped = getSkippedStepKinds(activities);
  const kept = steps.filter((step) => !skipped.has(step.kind));

  return kept.some((step) => step.kind !== "summary") ? kept : [...steps];
}
