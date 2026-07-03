import { createStepStream } from "@/workflows/_shared/stream-status";
import {
  type CourseWorkflowStepName,
  INTRODUCTION_LESSON_COMPLETION_STEP,
} from "@zoonk/core/workflows/steps";
import { prisma } from "@zoonk/db";

/**
 * Loads the public route pieces for the position-zero intro lesson. The course
 * generation page needs a route, not just a lesson id, because it redirects as
 * soon as this lesson is ready while the rest of course generation keeps going.
 */
async function getIntroductionLessonRoute({ lessonId }: { lessonId: string }): Promise<string> {
  const lesson = await prisma.lesson.findUnique({
    include: { chapter: { include: { course: true } } },
    where: { id: lessonId },
  });

  if (!lesson) {
    throw new Error("Introduction lesson not found");
  }

  if (lesson.position !== 0 || lesson.chapter.position !== 0) {
    throw new Error("Introduction lesson completion requires the first intro lesson");
  }

  return `${lesson.chapter.course.slug}/ch/${lesson.chapter.slug}/l/${lesson.slug}`;
}

/**
 * Streams the early redirect boundary for regular course generation. This is
 * deliberately separate from `completeCourseSetup`, which still marks the whole
 * course/request completed after the remaining course setup finishes.
 */
export async function completeIntroductionLessonStep({
  lessonId,
}: {
  lessonId: string;
}): Promise<void> {
  "use step";

  await using stream = createStepStream<CourseWorkflowStepName>();

  await stream.status({
    entityId: await getIntroductionLessonRoute({ lessonId }),
    status: "completed",
    step: INTRODUCTION_LESSON_COMPLETION_STEP,
  });
}
