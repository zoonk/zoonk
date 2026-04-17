import { createStepStream } from "@/workflows/_shared/stream-status";
import { type GeneratedCustomActivity } from "@zoonk/ai/tasks/lessons/custom-activities";
import { type AppliedActivityKind, type LessonStepName } from "@zoonk/core/workflows/steps";
import { type ActivityCreateManyInput, type LessonKind, prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { getActivitiesForKind } from "./_utils/get-activities-for-kind";
import { type LessonContext } from "./get-lesson-step";

export async function addActivitiesStep(input: {
  appliedActivityKind: AppliedActivityKind;
  concepts: string[];
  context: LessonContext;
  generationRunId: string;
  isPublished: boolean;
  lessonKind: LessonKind;
  customActivities: GeneratedCustomActivity[];
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
    input.appliedActivityKind,
  );

  const activitiesData: ActivityCreateManyInput[] = activitiesToCreate.map((activity, index) => ({
    description: activity.description,
    generationRunId: input.generationRunId,
    generationStatus: activity.kind === "review" ? "completed" : "pending",
    isPublished: input.isPublished,
    kind: activity.kind,
    language: input.context.language,
    lessonId: input.context.id,
    managementMode: "ai",
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
