import { type ActivityKind } from "@zoonk/core/steps/contract/content";
import { useExtracted } from "next-intl";

/**
 * Map an activity kind to a human-readable label. Used as fallback when
 * the activity has no custom title, matching how the activity list displays
 * activity kinds throughout the app.
 */
export function useActivityKindLabel(kind: ActivityKind): string {
  const t = useExtracted();

  const labels: Record<ActivityKind, string> = {
    custom: t("Activity"),
    explanation: t("Explanation"),
    grammar: t("Grammar"),
    listening: t("Listening"),
    practice: t("Practice"),
    quiz: t("Quiz"),
    reading: t("Reading"),
    review: t("Review"),
    translation: t("Translation"),
    vocabulary: t("Vocabulary"),
  };

  return labels[kind];
}
