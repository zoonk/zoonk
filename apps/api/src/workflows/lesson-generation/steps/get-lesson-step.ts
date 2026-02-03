import { prisma } from "@zoonk/db";
import { FatalError } from "workflow";
import { streamStatus } from "../stream-status";

async function getLessonForGeneration(lessonId: number) {
  return prisma.lesson.findUnique({
    select: {
      _count: {
        select: {
          activities: true,
        },
      },
      chapter: {
        select: {
          course: {
            select: {
              title: true,
            },
          },
          title: true,
        },
      },
      description: true,
      generationRunId: true,
      generationStatus: true,
      id: true,
      kind: true,
      language: true,
      organizationId: true,
      slug: true,
      title: true,
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
    await streamStatus({ status: "error", step: "getLesson" });
    throw new FatalError("Lesson not found");
  }

  await streamStatus({ status: "completed", step: "getLesson" });

  return lesson;
}
