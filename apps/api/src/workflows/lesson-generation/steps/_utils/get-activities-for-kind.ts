import { type GeneratedCoreActivity } from "@zoonk/ai/tasks/lessons/core-activities";
import { type GeneratedCustomActivity } from "@zoonk/ai/tasks/lessons/custom-activities";
import { type AppliedActivityKind } from "@zoonk/core/workflows/steps";
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

const MIN_EXPLANATIONS_FOR_TWO_PRACTICES = 3;

function createActivityEntry({
  description = null,
  kind,
  title = null,
}: {
  kind: ActivityKind;
  title?: string | null;
  description?: string | null;
}): ActivityEntry {
  return { description, kind, title };
}

/**
 * Core-lesson planning now happens before rows are created, so this helper
 * translates each AI-planned explanation entry into the fixed activity shell
 * that downstream generation expects. The goal is stored in `description`
 * because explanation generation already receives that field as durable row
 * context.
 */
function getCoreActivities({
  appliedActivityKind,
  coreActivities,
  lessonTitle,
}: {
  appliedActivityKind: AppliedActivityKind;
  coreActivities: GeneratedCoreActivity[];
  lessonTitle: string;
}): ActivityEntry[] {
  const explanations = coreActivities.map((activity) =>
    createActivityEntry({
      description: activity.goal,
      kind: "explanation",
      title: activity.title,
    }),
  );

  const allExplanations =
    explanations.length > 0
      ? explanations
      : [createActivityEntry({ kind: "explanation", title: lessonTitle })];

  const appliedActivities = appliedActivityKind
    ? [createActivityEntry({ kind: appliedActivityKind })]
    : [];

  if (allExplanations.length < MIN_EXPLANATIONS_FOR_TWO_PRACTICES) {
    return [
      ...allExplanations,
      createActivityEntry({ kind: "practice" }),
      createActivityEntry({ kind: "quiz" }),
      ...appliedActivities,
      createActivityEntry({ kind: "review" }),
    ];
  }

  const splitIndex = Math.max(1, Math.floor(allExplanations.length / 2));
  const firstGroup = allExplanations.slice(0, splitIndex);
  const secondGroup = allExplanations.slice(splitIndex);

  return [
    ...firstGroup,
    createActivityEntry({ kind: "practice" }),
    ...secondGroup,
    createActivityEntry({ kind: "practice" }),
    createActivityEntry({ kind: "quiz" }),
    ...appliedActivities,
    createActivityEntry({ kind: "review" }),
  ];
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
 *   derived from the AI-planned explanation titles.
 * - "language" lessons get a fixed set of activity kinds (vocabulary,
 *   translation, grammar, reading, listening, review).
 * - "custom" lessons use AI-generated activity definitions.
 */
export function getActivitiesForKind({
  appliedActivityKind = null,
  coreActivities,
  customActivities,
  lessonKind,
  lessonTitle,
  targetLanguage,
}: {
  lessonKind: LessonKind;
  lessonTitle: string;
  customActivities: GeneratedCustomActivity[];
  coreActivities: GeneratedCoreActivity[];
  targetLanguage: string | null;
  appliedActivityKind?: AppliedActivityKind;
}): ActivityEntry[] {
  if (lessonKind === "core") {
    return getCoreActivities({
      appliedActivityKind,
      coreActivities,
      lessonTitle,
    });
  }

  if (lessonKind === "language") {
    return getLanguageActivities(targetLanguage).map((kind) => createActivityEntry({ kind }));
  }

  return customActivities.map((activity) =>
    createActivityEntry({
      description: activity.description,
      kind: "custom",
      title: activity.title,
    }),
  );
}
