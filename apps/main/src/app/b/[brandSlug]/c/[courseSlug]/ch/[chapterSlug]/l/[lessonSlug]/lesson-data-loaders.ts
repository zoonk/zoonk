import { getNextLessonInCourse } from "@zoonk/core/lessons/next-in-course";
import { getLesson } from "@zoonk/core/player/queries/get-lesson";
import { getNextSibling } from "@zoonk/core/player/queries/get-next-sibling";
import { getReviewSteps } from "@zoonk/core/player/queries/get-review-steps";
import { getSession } from "@zoonk/core/users/session/get";
import { prisma } from "@zoonk/db";

type ReviewLessonData = {
  generationLessonId: string | null;
  steps: Awaited<ReturnType<typeof getReviewSteps>>;
};

/**
 * Finds the first earlier generated lesson that still needs content before a
 * review lesson can have anything useful to replay.
 */
async function getFirstIncompleteGeneratedLessonBeforeReview({
  chapterId,
  position,
}: {
  chapterId: string;
  position: number;
}) {
  return prisma.lesson.findFirst({
    orderBy: { position: "asc" },
    where: {
      chapterId,
      generationStatus: { not: "completed" },
      isPublished: true,
      kind: { notIn: ["custom", "review"] },
      position: { lt: position },
    },
  });
}

/**
 * Review lessons do not own generated steps, so the page needs both the dynamic
 * review steps and a fallback generation target when those steps are empty.
 */
export async function fetchReviewLessonData(lessonId: string): Promise<ReviewLessonData | null> {
  const lesson = await getLesson({ lessonId });

  if (lesson?.kind !== "review") {
    return null;
  }

  const session = await getSession();

  const [steps, generationLesson] = await Promise.all([
    getReviewSteps({
      lessonId,
      userId: session ? session.user.id : null,
    }),
    getFirstIncompleteGeneratedLessonBeforeReview({
      chapterId: lesson.chapterId,
      position: lesson.position,
    }),
  ]);

  return {
    generationLessonId: generationLesson?.id ?? null,
    steps,
  };
}

export async function fetchNextSibling(
  lessonId: string,
  chapter: { id: string; position: number; course: { id: string } },
  lessonPosition: number,
) {
  const nextLesson = await getNextLessonInCourse({
    chapterId: chapter.id,
    chapterPosition: chapter.position,
    courseId: chapter.course.id,
    lessonId,
    lessonPosition,
  });

  if (nextLesson) {
    return null;
  }

  return getNextSibling({
    chapterId: chapter.id,
    chapterPosition: chapter.position,
    courseId: chapter.course.id,
    lessonPosition,
    level: "lesson",
  });
}
