import { type ActivityKind, type LessonKind, prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { isTTSSupportedLanguage } from "@zoonk/utils/languages";
import { streamStatus } from "../stream-status";
import { type GeneratedActivity } from "./generate-custom-activities-step";
import { type LessonContext } from "./get-lesson-step";

const CORE_ACTIVITY_KINDS: ActivityKind[] = [
  "background",
  "explanation",
  "quiz",
  "mechanics",
  "examples",
  "story",
  "challenge",
  "review",
];

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
  customActivities: GeneratedActivity[],
  targetLanguage: string | null,
): {
  kind: ActivityKind;
  title: string | null;
  description: string | null;
}[] {
  if (lessonKind === "core") {
    return CORE_ACTIVITY_KINDS.map((kind) => ({
      description: null,
      kind,
      title: null,
    }));
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

  const activitiesToCreate = getActivitiesForKind(
    input.lessonKind,
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
    await streamStatus({ status: "error", step: "addActivities" });
    throw error;
  }

  await streamStatus({ status: "completed", step: "addActivities" });
}
