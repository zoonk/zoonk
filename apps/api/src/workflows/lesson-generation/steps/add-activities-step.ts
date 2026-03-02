import { type ActivityKind, type LessonKind, prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { isTTSSupportedLanguage } from "@zoonk/utils/languages";
import { streamError, streamStatus } from "../stream-status";
import { type GeneratedActivity } from "./generate-custom-activities-step";
import { type LessonContext } from "./get-lesson-step";

const CORE_TAIL_ACTIVITY_KINDS: ActivityKind[] = [
  "mechanics",
  "examples",
  "story",
  "challenge",
  "review",
];

const MIN_CONCEPTS_FOR_TWO_QUIZZES = 4;

const LANGUAGE_ACTIVITY_KINDS: ActivityKind[] = [
  "vocabulary",
  "grammar",
  "reading",
  "listening",
  "languageStory",
  "languageReview",
];

function getLanguageActivities(targetLanguage: string | null): ActivityKind[] {
  if (isTTSSupportedLanguage(targetLanguage)) {
    return LANGUAGE_ACTIVITY_KINDS;
  }

  return LANGUAGE_ACTIVITY_KINDS.filter((kind) => kind !== "listening");
}

function getActivitiesForKind(
  lessonKind: LessonKind,
  lessonConcepts: string[],
  customActivities: GeneratedActivity[],
  targetLanguage: string | null,
): {
  kind: ActivityKind;
  title: string | null;
  description: string | null;
}[] {
  if (lessonKind === "core") {
    if (lessonConcepts.length === 0) {
      return [];
    }

    const midpoint = Math.floor(lessonConcepts.length / 2);
    const shouldCreateTwoQuizzes = lessonConcepts.length >= MIN_CONCEPTS_FOR_TWO_QUIZZES;

    const firstConceptBlock = shouldCreateTwoQuizzes
      ? lessonConcepts.slice(0, midpoint)
      : lessonConcepts;

    const secondConceptBlock = shouldCreateTwoQuizzes ? lessonConcepts.slice(midpoint) : [];

    const firstExplanationActivities = firstConceptBlock.map((concept) => ({
      description: null,
      kind: "explanation" as const,
      title: concept,
    }));

    const secondExplanationActivities = secondConceptBlock.map((concept) => ({
      description: null,
      kind: "explanation" as const,
      title: concept,
    }));

    const leadingActivities = [
      { description: null, kind: "background" as const, title: null },
      ...firstExplanationActivities,
      { description: null, kind: "quiz" as const, title: null },
    ];

    const quizActivities = shouldCreateTwoQuizzes
      ? [
          ...leadingActivities,
          ...secondExplanationActivities,
          { description: null, kind: "quiz" as const, title: null },
        ]
      : leadingActivities;

    const trailingActivities = CORE_TAIL_ACTIVITY_KINDS.map((kind) => ({
      description: null,
      kind,
      title: null,
    }));

    return [...quizActivities, ...trailingActivities];
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

export async function addActivitiesStep(input: {
  context: LessonContext;
  lessonKind: LessonKind;
  customActivities: GeneratedActivity[];
  targetLanguage: string | null;
}): Promise<void> {
  "use step";

  await streamStatus({ status: "started", step: "addActivities" });

  if (input.lessonKind === "core" && input.context.concepts.length === 0) {
    await streamError({ reason: "noSourceData", step: "addActivities" });
    throw new Error("Core lesson must have concepts before adding activities");
  }

  const activitiesToCreate = getActivitiesForKind(
    input.lessonKind,
    input.context.concepts,
    input.customActivities,
    input.targetLanguage,
  );

  const activitiesData = activitiesToCreate.map((activity, index) => ({
    description: activity.description,
    generationStatus: "pending" as const,
    isPublished: true,
    kind: activity.kind,
    language: input.context.language,
    lessonId: input.context.id,
    organizationId: input.context.organizationId,
    position: index,
    title: activity.title,
  }));

  const { error } = await safeAsync(() => prisma.activity.createMany({ data: activitiesData }));

  if (error) {
    await streamError({ reason: "dbSaveFailed", step: "addActivities" });
    throw error;
  }

  await streamStatus({ status: "completed", step: "addActivities" });
}
