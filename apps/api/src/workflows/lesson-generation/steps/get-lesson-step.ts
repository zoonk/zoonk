import { prisma } from "@zoonk/db";
import { FatalError } from "workflow";
import { streamError, streamStatus } from "../stream-status";

async function getLessonForGeneration(lessonId: number) {
  return prisma.lesson.findUnique({
    include: {
      _count: { select: { activities: true } },
      chapter: { include: { course: true } },
    },
    where: { id: lessonId },
  });
}

export type LessonContext = NonNullable<Awaited<ReturnType<typeof getLessonForGeneration>>>;

export async function getLessonStep(lessonId: number): Promise<LessonContext> {
  "use step";

  await streamStatus({ status: "started", step: "getLesson" });

  const lesson = await getLessonForGeneration(lessonId);

  if (!lesson) {
    await streamError({ reason: "notFound", step: "getLesson" });
    throw new FatalError("Lesson not found");
  }

  await streamStatus({ status: "completed", step: "getLesson" });

  return lesson;
}
