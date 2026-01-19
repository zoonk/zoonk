import type { ActivityKind } from "@zoonk/db";
import { getExtracted } from "next-intl/server";

export type ActivityKindInfo = {
  key: ActivityKind;
  label: string;
  description: string;
};

export async function getActivityKinds(params?: {
  locale: string;
}): Promise<ActivityKindInfo[]> {
  const t = await getExtracted(params);

  return [
    {
      description: t(
        "The story behind this topic - why it was created and why it matters",
      ),
      key: "background",
      label: t("Background"),
    },
    {
      description: t(
        "Make strategic decisions in a simulated real-world scenario",
      ),
      key: "challenge",
      label: t("Challenge"),
    },
    {
      description: t("Custom activity"),
      key: "custom",
      label: t("Custom"),
    },
    {
      description: t(
        "Real-world situations where you'll use this in your life",
      ),
      key: "examples",
      label: t("Examples"),
    },
    {
      description: t(
        "Key concepts explained clearly so you understand how it works",
      ),
      key: "explanation",
      label: t("Explanation"),
    },
    {
      description: t(
        "Practical grammar tips with exercises to remember the rules",
      ),
      key: "grammar",
      label: t("Grammar"),
    },
    {
      description: t(
        "Listen to sentences and translate them by arranging words",
      ),
      key: "listening",
      label: t("Listening"),
    },
    {
      description: t(
        "How it works under the hood - the processes and systems behind it",
      ),
      key: "mechanics",
      label: t("Mechanics"),
    },
    {
      description: t("Learn pronunciation tips to sound more natural"),
      key: "pronunciation",
      label: t("Pronunciation"),
    },
    {
      description: t(
        "Test your understanding with questions based on the explanation",
      ),
      key: "quiz",
      label: t("Quiz"),
    },
    {
      description: t("Practice reading comprehension by translating sentences"),
      key: "reading",
      label: t("Reading"),
    },
    {
      description: t("Review everything you learned in this lesson"),
      key: "review",
      label: t("Review"),
    },
    {
      description: t("Work with a colleague to solve a real-world problem"),
      key: "story",
      label: t("Story"),
    },
    {
      description: t("Learn new words to expand your vocabulary"),
      key: "vocabulary",
      label: t("Vocabulary"),
    },
  ];
}
