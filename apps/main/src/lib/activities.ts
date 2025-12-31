import type { ActivityKind } from "@zoonk/utils/activities";
import { getExtracted } from "next-intl/server";

export type ActivityKindInfo = {
  key: ActivityKind;
  label: string;
};

export async function getActivityKinds(params?: {
  locale: string;
}): Promise<ActivityKindInfo[]> {
  const t = await getExtracted(params);

  return [
    { key: "background", label: t("Background") },
    { key: "challenge", label: t("Challenge") },
    { key: "examples", label: t("Examples") },
    { key: "explanation", label: t("Explanation") },
    { key: "explanation_quiz", label: t("Quiz") },
    { key: "grammar", label: t("Grammar") },
    { key: "lesson_quiz", label: t("Lesson Quiz") },
    { key: "listening", label: t("Listening") },
    { key: "logic", label: t("Logic") },
    { key: "mechanics", label: t("Mechanics") },
    { key: "pronunciation", label: t("Pronunciation") },
    { key: "reading", label: t("Reading") },
    { key: "review", label: t("Review") },
    { key: "story", label: t("Story") },
    { key: "vocabulary", label: t("Vocabulary") },
  ];
}

export async function getActivityKindLabel(
  kind: string,
  opts?: { locale: string },
): Promise<string> {
  const t = await getExtracted(opts);
  const kinds = await getActivityKinds(opts);
  return kinds.find((k) => k.key === kind)?.label ?? t("Activity");
}
