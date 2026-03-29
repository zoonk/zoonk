import { createStepStream } from "@/workflows/_shared/stream-status";
import { type GeneratedActivity } from "@zoonk/ai/tasks/lessons/activities";
import { type LessonStepName } from "@zoonk/core/workflows/steps";
import { type ActivityCreateManyInput, type LessonKind, prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { getActivitiesForKind } from "./_utils/get-activities-for-kind";
import { type LessonContext } from "./get-lesson-step";

export async function addActivitiesStep(input: {
  concepts: string[];
  context: LessonContext;
  lessonKind: LessonKind;
  customActivities: GeneratedActivity[];
  targetLanguage: string | null;
}): Promise<void> {
  "use step";

  await using stream = createStepStream<LessonStepName>();

  await stream.status({ status: "started", step: "addActivities" });

  const activitiesToCreate = getActivitiesForKind(
    input.lessonKind,
    input.customActivities,
    input.targetLanguage,
    input.concepts,
  );

  const activitiesData: ActivityCreateManyInput[] = activitiesToCreate.map((activity, index) => ({
    description: activity.description,
    generationStatus: activity.kind === "review" ? "completed" : "pending",
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
    await stream.error({ reason: "dbSaveFailed", step: "addActivities" });
    throw error;
  }

  await stream.status({ status: "completed", step: "addActivities" });
}
