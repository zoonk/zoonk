import type { ActivityKind } from "@zoonk/db";
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
    { key: "custom", label: t("Custom") },
    { key: "examples", label: t("Examples") },
    { key: "explanation", label: t("Explanation") },
    { key: "grammar", label: t("Grammar") },
    { key: "listening", label: t("Listening") },
    { key: "mechanics", label: t("Mechanics") },
    { key: "pronunciation", label: t("Pronunciation") },
    { key: "quiz", label: t("Quiz") },
    { key: "reading", label: t("Reading") },
    { key: "review", label: t("Review") },
    { key: "story", label: t("Story") },
    { key: "vocabulary", label: t("Vocabulary") },
  ];
}
