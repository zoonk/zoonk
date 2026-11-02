import { type StepKind } from "@zoonk/db";

export const LANGUAGE_ACTIVITY_TYPES = ["vocabulary", "listening", "writing", "speaking"] as const;

export type LanguageActivityType = (typeof LANGUAGE_ACTIVITY_TYPES)[number];

const ACTIVITY_STEP_KINDS: Readonly<Record<LanguageActivityType, readonly StepKind[]>> = {
  listening: ["listening"],
  speaking: ["spokenAnswer"],
  vocabulary: ["vocabulary", "translation"],
  writing: ["typedAnswer"],
};

function getSkippedStepKinds(activities: readonly LanguageActivityType[]): Set<StepKind> {
  return new Set(activities.flatMap((activity) => ACTIVITY_STEP_KINDS[activity]));
}

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
