import { createStepStream } from "@/workflows/_shared/stream-status";
import { type LessonStepName } from "@zoonk/core/workflows/steps";
import { getActiveLessonWhere, prisma } from "@zoonk/db";
import { FatalError } from "workflow";

async function getLessonForGeneration(lessonId: number) {
  return prisma.lesson.findFirst({
    include: {
      _count: { select: { activities: true } },
      chapter: { include: { course: true } },
    },
    where: getActiveLessonWhere({
      lessonWhere: { id: lessonId },
    }),
  });
}

export type LessonContext = NonNullable<Awaited<ReturnType<typeof getLessonForGeneration>>>;

export async function getLessonStep(lessonId: number): Promise<LessonContext> {
  "use step";

  await using stream = createStepStream<LessonStepName>();

  await stream.status({ status: "started", step: "getLesson" });

  const lesson = await getLessonForGeneration(lessonId);

  if (!lesson) {
    await stream.error({ reason: "notFound", step: "getLesson" });
    throw new FatalError("Lesson not found");
  }

  await stream.status({ status: "completed", step: "getLesson" });

  return lesson;
}
