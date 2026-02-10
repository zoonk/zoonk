import { type LessonKind, prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { streamError, streamStatus } from "../stream-status";

export async function updateLessonKindStep(input: {
  lessonId: number;
  kind: LessonKind;
}): Promise<void> {
  "use step";

  await streamStatus({ status: "started", step: "updateLessonKind" });

  const { error } = await safeAsync(() =>
    prisma.lesson.update({
      data: { kind: input.kind },
      select: { id: true, kind: true },
      where: { id: input.lessonId },
    }),
  );

  if (error) {
    await streamError({ reason: "dbSaveFailed", step: "updateLessonKind" });
    throw error;
  }

  await streamStatus({ status: "completed", step: "updateLessonKind" });
}
