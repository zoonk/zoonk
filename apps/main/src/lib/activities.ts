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
      description: t("Learn new words and their translations to build your vocabulary."),
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
      description: t("Read sentences and translate them to practice reading comprehension."),
      key: "reading",
      label: t("Reading"),
    },
    {
      description: t("Listen to audio sentences and translate them to practice listening skills."),
      key: "listening",
      label: t("Listening"),
    },
    {
      description: t("A comprehensive quiz covering everything you learned in this lesson."),
      key: "review",
      label: t("Review"),
    },
    {
      description: t(
        "A dialogue-based story that helps you practice the language in a real-world context.",
      ),
      key: "languageStory",
      label: t("Story"),
    },
    {
      description: t("A comprehensive review covering vocabulary and skills from this lesson."),
      key: "languageReview",
      label: t("Review"),
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
      "See where {topic} appears in real life — in daily routines, work, pop culture, and unexpected places.",
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
    languageReview: t(
      "Review vocabulary and skills from {topic} with a comprehensive assessment.",
      { topic },
    ),
    languageStory: t(
      "Practice {topic} in context through a dialogue-based story set in real-world situations.",
      { topic },
    ),
    listening: t("Sharpen your {topic} listening skills by translating audio sentences.", {
      topic,
    }),
    mechanics: t(
      "Learn how {topic} works under the hood — processes, sequences, and cause-effect chains explained.",
      { topic },
    ),
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

  if (activity.kind === "custom" && activity.title) {
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
