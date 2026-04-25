import { createStepStream } from "@/workflows/_shared/stream-status";
import { type LessonStepName } from "@zoonk/core/workflows/steps";
import { type LessonKind, prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";

export async function updateLessonKindStep(input: {
  lessonId: string;
  kind: LessonKind;
}): Promise<void> {
  "use step";

  await using stream = createStepStream<LessonStepName>();

  await stream.status({ status: "started", step: "updateLessonKind" });

  const { error } = await safeAsync(() =>
    prisma.lesson.update({
      data: { kind: input.kind },
      where: { id: input.lessonId },
    }),
  );

  if (error) {
    throw error;
  }

  await stream.status({ status: "completed", step: "updateLessonKind" });
}
