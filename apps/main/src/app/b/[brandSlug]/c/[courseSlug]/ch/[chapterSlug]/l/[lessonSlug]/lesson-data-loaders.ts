import { getNextLessonInCourse } from "@zoonk/core/lessons/next-in-course";
import { getLesson } from "@zoonk/core/player/queries/get-lesson";
import { getNextSibling } from "@zoonk/core/player/queries/get-next-sibling";
import { getReviewSteps } from "@zoonk/core/player/queries/get-review-steps";
import { getSession } from "@zoonk/core/users/session/get";

export async function fetchReviewSteps(lessonId: string) {
  const lesson = await getLesson({ lessonId });

  if (lesson?.kind !== "review") {
    return null;
  }

  const session = await getSession();

  return getReviewSteps({
    lessonId,
    userId: session ? session.user.id : null,
  });
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
