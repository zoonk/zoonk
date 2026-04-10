import { createStepStream } from "@/workflows/_shared/stream-status";
import { getTargetLessonGenerationVersion } from "@zoonk/core/content/management";
import { type LessonStepName } from "@zoonk/core/workflows/steps";
import { type LessonKind, prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { type LessonContext } from "./get-lesson-step";

export async function setLessonAsCompletedStep(input: {
  context: LessonContext;
  lessonKind: LessonKind;
  workflowRunId: string;
}): Promise<void> {
  "use step";

  await using stream = createStepStream<LessonStepName>();

  await stream.status({ status: "started", step: "setLessonAsCompleted" });

  const { error } = await safeAsync(() =>
    prisma.lesson.update({
      data: {
        generationRunId: input.workflowRunId,
        generationStatus: "completed",
        generationVersion: getTargetLessonGenerationVersion(input.lessonKind),
      },
      where: { id: input.context.id },
    }),
  );

  if (error) {
    await stream.error({ reason: "dbSaveFailed", step: "setLessonAsCompleted" });
    throw error;
  }

  await stream.status({ status: "completed", step: "setLessonAsCompleted" });
}
