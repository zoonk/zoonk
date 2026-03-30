import { type ActivityKind } from "@zoonk/db";
import {
  BookOpenIcon,
  BookTextIcon,
  BracesIcon,
  CircleHelpIcon,
  HeadphonesIcon,
  LanguagesIcon,
  LayersIcon,
  type LucideIcon,
  RotateCcwIcon,
  ScaleIcon,
  SparklesIcon,
  TargetIcon,
} from "lucide-react";
import { getExtracted } from "next-intl/server";

export async function getActivityKinds(): Promise<{ key: ActivityKind; label: string }[]> {
  const t = await getExtracted();

  return [
    { key: "explanation", label: t("Explanation") },
    { key: "quiz", label: t("Quiz") },
    { key: "practice", label: t("Practice") },
    { key: "vocabulary", label: t("Vocabulary") },
    { key: "translation", label: t("Translation") },
    { key: "grammar", label: t("Grammar") },
    { key: "reading", label: t("Reading") },
    { key: "listening", label: t("Listening") },
    { key: "tradeoff", label: t("Tradeoff") },
    { key: "review", label: t("Review") },
  ];
}

async function getSeoDescription(kind: ActivityKind, topic: string): Promise<string> {
  const t = await getExtracted();

  const descriptions: Record<ActivityKind, string> = {
    custom: t("Learn about {topic} through an interactive activity.", { topic }),
    explanation: t(
      "Understand what {topic} is — core concepts and definitions explained with clear metaphors and analogies.",
      { topic },
    ),
    grammar: t(
      "Practice {topic} grammar rules with exercises designed to help you remember and apply them.",
      { topic },
    ),

    listening: t("Sharpen your {topic} listening skills by translating audio sentences.", {
      topic,
    }),
    practice: t("Apply {topic} through a real-world dialogue scenario.", { topic }),
    quiz: t(
      "Test your understanding of {topic} with questions designed to check real comprehension, not just memorization.",
      { topic },
    ),
    reading: t(
      "Improve your {topic} reading comprehension by translating sentences and passages.",
      { topic },
    ),
    review: t("Review everything you learned about {topic} with a comprehensive quiz.", { topic }),
    tradeoff: t(
      "Navigate real-world tradeoffs about {topic} — allocate limited resources across competing priorities and see how your choices play out.",
      { topic },
    ),
    translation: t("Test your {topic} vocabulary by translating words you've learned.", { topic }),
    vocabulary: t(
      "Learn new {topic} words with flashcards — see each word, its translation, and pronunciation.",
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

const ACTIVITY_ICONS: Record<ActivityKind, LucideIcon> = {
  custom: SparklesIcon,
  explanation: BookOpenIcon,
  grammar: BracesIcon,

  listening: HeadphonesIcon,
  practice: TargetIcon,
  quiz: CircleHelpIcon,
  reading: BookTextIcon,
  review: RotateCcwIcon,
  tradeoff: ScaleIcon,
  translation: LanguagesIcon,
  vocabulary: LayersIcon,
};

export function getActivityIcon(kind: ActivityKind): LucideIcon {
  return ACTIVITY_ICONS[kind];
}
