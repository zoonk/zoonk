import { type ActivityKind } from "@zoonk/db";
import { getExtracted } from "next-intl/server";

export async function getActivityKinds(): Promise<
  {
    key: ActivityKind;
    label: string;
    description: string;
  }[]
> {
  const t = await getExtracted();

  return [
    {
      description: t("Why this topic exists and why it matters"),
      key: "background",
      label: t("Background"),
    },
    {
      description: t("Core concepts and definitions"),
      key: "explanation",
      label: t("Explanation"),
    },
    {
      description: t("Test your knowledge"),
      key: "quiz",
      label: t("Quiz"),
    },
    {
      description: t("See how it works in practice"),
      key: "examples",
      label: t("Examples"),
    },
    {
      description: t("Apply the topic in a real scenario"),
      key: "story",
      label: t("Story"),
    },
    {
      description: t("Make decisions with real trade-offs"),
      key: "challenge",
      label: t("Challenge"),
    },
    {
      description: t("Build your vocabulary"),
      key: "vocabulary",
      label: t("Vocabulary"),
    },
    {
      description: t("Practice grammar rules"),
      key: "grammar",
      label: t("Grammar"),
    },
    {
      description: t("Practice reading comprehension"),
      key: "reading",
      label: t("Reading"),
    },
    {
      description: t("Practice listening skills"),
      key: "listening",
      label: t("Listening"),
    },
    {
      description: t("Review everything you learned"),
      key: "review",
      label: t("Review"),
    },
    {
      description: t("Practice in a real-world dialogue"),
      key: "languageStory",
      label: t("Story"),
    },
  ];
}

async function getSeoDescription(kind: ActivityKind, topic: string): Promise<string> {
  const t = await getExtracted();

  const descriptions: Record<ActivityKind, string> = {
    background: t(
      "Discover why {topic} matters — its origins, the problems it solved, and why it's important today.",
      { topic },
    ),
    challenge: t(
      "Apply your knowledge of {topic} through analytical decisions with real trade-offs.",
      { topic },
    ),
    custom: t("Learn about {topic} through an interactive activity.", { topic }),
    examples: t(
      "See how {topic} works through practical demonstrations and where it appears in real life.",
      { topic },
    ),
    explanation: t(
      "Understand what {topic} is — core concepts and definitions explained with clear metaphors and analogies.",
      { topic },
    ),
    grammar: t(
      "Practice {topic} grammar rules with exercises designed to help you remember and apply them.",
      { topic },
    ),
    languageStory: t(
      "Practice {topic} in context through a dialogue-based story set in real-world situations.",
      { topic },
    ),
    listening: t("Sharpen your {topic} listening skills by translating audio sentences.", {
      topic,
    }),
    quiz: t(
      "Test your understanding of {topic} with questions designed to check real comprehension, not just memorization.",
      { topic },
    ),
    reading: t(
      "Improve your {topic} reading comprehension by translating sentences and passages.",
      { topic },
    ),
    review: t("Review everything you learned about {topic} with a comprehensive quiz.", { topic }),
    story: t("Experience when to apply {topic} through a real-world dialogue scenario.", { topic }),
    vocabulary: t(
      "Build your {topic} vocabulary with new words, translations, and pronunciation.",
      { topic },
    ),
  };

  return descriptions[kind];
}

export async function getActivitySeoMeta(
  activity: { kind: ActivityKind; title: string | null; description: string | null },
  lessonTitle: string,
): Promise<{ title: string; description: string }> {
  const [title, description] = await Promise.all([
    getSeoTitle(activity, lessonTitle),
    getSeoActivityDescription(activity, lessonTitle),
  ]);

  return { description, title };
}

async function getSeoTitle(
  activity: { kind: ActivityKind; title: string | null },
  lessonTitle: string,
): Promise<string> {
  const t = await getExtracted();

  if (activity.title) {
    return t("{activity} - {lesson}", { activity: activity.title, lesson: lessonTitle });
  }

  const kinds = await getActivityKinds();
  const kindInfo = kinds.find((kind) => kind.key === activity.kind);

  if (kindInfo) {
    return t("{lesson} {activity}", { activity: kindInfo.label, lesson: lessonTitle });
  }

  return lessonTitle;
}

async function getSeoActivityDescription(
  activity: { kind: ActivityKind; description: string | null },
  lessonTitle: string,
): Promise<string> {
  if (activity.kind === "custom" && activity.description) {
    return activity.description;
  }

  return getSeoDescription(activity.kind, lessonTitle);
}
