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
        "Explains WHY this topic exists. Tells the origin story, the problems it solved, and why it matters today.",
      ),
      key: "background",
      label: t("Background"),
    },
    {
      description: t(
        "Explains WHAT this topic is. Breaks down core concepts and definitions using metaphors and analogies.",
      ),
      key: "explanation",
      label: t("Explanation"),
    },
    {
      description: t(
        "Tests your understanding with questions. Uses new scenarios to check if you grasped the concept, not just memorized it.",
      ),
      key: "quiz",
      label: t("Quiz"),
    },
    {
      description: t(
        "Explains HOW things work under the hood. Shows the processes, sequences, and cause-effect chains in action.",
      ),
      key: "mechanics",
      label: t("Mechanics"),
    },
    {
      description: t(
        "Shows WHERE this topic appears in real life. Helps you recognize it in daily routines, work, pop culture, and unexpected places.",
      ),
      key: "examples",
      label: t("Examples"),
    },
    {
      description: t(
        "Shows WHEN to apply this topic. A dialogue with a colleague where you solve a real problem together.",
      ),
      key: "story",
      label: t("Story"),
    },
    {
      description: t(
        "Tests analytical thinking through decisions with trade-offs. See how each choice impacts different outcomes.",
      ),
      key: "challenge",
      label: t("Challenge"),
    },
    {
      description: t(
        "Learn new words and their translations to build your vocabulary.",
      ),
      key: "vocabulary",
      label: t("Vocabulary"),
    },
    {
      description: t(
        "Teaches grammar rules with practical exercises to help you remember and apply them.",
      ),
      key: "grammar",
      label: t("Grammar"),
    },
    {
      description: t(
        "Read sentences and translate them to practice reading comprehension.",
      ),
      key: "reading",
      label: t("Reading"),
    },
    {
      description: t(
        "Listen to audio sentences and translate them to practice listening skills.",
      ),
      key: "listening",
      label: t("Listening"),
    },
    {
      description: t(
        "A comprehensive quiz covering everything you learned in this lesson.",
      ),
      key: "review",
      label: t("Review"),
    },
  ];
}
