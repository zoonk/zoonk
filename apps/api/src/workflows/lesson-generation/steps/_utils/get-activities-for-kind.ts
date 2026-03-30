import { type GeneratedActivity } from "@zoonk/ai/tasks/lessons/activities";
import { type ActivityKind, type LessonKind } from "@zoonk/db";
import { isTTSSupportedLanguage } from "@zoonk/utils/languages";

type ActivityEntry = {
  kind: ActivityKind;
  title: string | null;
  description: string | null;
};

const LANGUAGE_ACTIVITY_KINDS: ActivityKind[] = [
  "vocabulary",
  "translation",
  "grammar",
  "reading",
  "listening",
  "review",
];

/**
 * Returns the list of core activities for a lesson based on the number
 * of concepts.
 *
 * Core lessons always include explanations (one per concept), a quiz,
 * and a review activity. When there are 4+ concepts, two practice
 * activities are inserted — one after the first half of explanations
 * and another after the second half — to break up long sequences.
 *
 * Example with 5 concepts:
 *   [exp1, exp2, practice, exp3, exp4, exp5, practice, quiz, review]
 */
function getCoreActivities(concepts: string[]): ActivityEntry[] {
  const explanations: ActivityEntry[] = concepts.map((concept) => ({
    description: null,
    kind: "explanation",
    title: concept,
  }));

  const fallbackExplanation: ActivityEntry[] =
    explanations.length === 0 ? [{ description: null, kind: "explanation", title: null }] : [];

  const allExplanations = [...fallbackExplanation, ...explanations];

  const practice: ActivityEntry = { description: null, kind: "practice", title: null };
  const review: ActivityEntry = { description: null, kind: "review", title: null };
  const quiz: ActivityEntry = { description: null, kind: "quiz", title: null };

  const minConceptsForTwoPractices = 4;

  if (concepts.length < minConceptsForTwoPractices) {
    return [...allExplanations, practice, quiz, review];
  }

  const splitIndex = Math.floor(concepts.length / 2);
  const firstGroup = explanations.slice(0, splitIndex);
  const secondGroup = explanations.slice(splitIndex);

  return [...firstGroup, practice, ...secondGroup, practice, quiz, review];
}

/**
 * Returns the list of activity kinds for a language lesson.
 * Listening is excluded when the target language doesn't support
 * text-to-speech (TTS).
 */
function getLanguageActivities(targetLanguage: string | null): ActivityKind[] {
  if (isTTSSupportedLanguage(targetLanguage)) {
    return LANGUAGE_ACTIVITY_KINDS;
  }

  return LANGUAGE_ACTIVITY_KINDS.filter((kind) => kind !== "listening");
}

/**
 * Returns the full activity list for a lesson based on its kind.
 *
 * - "core" lessons get explanation/practice/quiz/review activities
 *   derived from the lesson's concepts.
 * - "language" lessons get a fixed set of activity kinds (vocabulary,
 *   translation, grammar, reading, listening, review).
 * - "custom" lessons use AI-generated activity definitions.
 */
export function getActivitiesForKind(
  lessonKind: LessonKind,
  customActivities: GeneratedActivity[],
  targetLanguage: string | null,
  concepts: string[],
): ActivityEntry[] {
  if (lessonKind === "core") {
    return getCoreActivities(concepts);
  }

  if (lessonKind === "language") {
    return getLanguageActivities(targetLanguage).map((kind) => ({
      description: null,
      kind,
      title: null,
    }));
  }

  return customActivities.map((activity) => ({
    description: activity.description,
    kind: "custom" as const,
    title: activity.title,
  }));
}
