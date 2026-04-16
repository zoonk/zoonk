import { getNextActivityInCourse } from "@zoonk/core/activities/next-in-course";
import { getActivity } from "@zoonk/core/player/queries/get-activity";
import { getNextSibling } from "@zoonk/core/player/queries/get-next-sibling";
import { getReviewSteps } from "@zoonk/core/player/queries/get-review-steps";
import { getSession } from "@zoonk/core/users/session/get";

export async function fetchReviewSteps(lessonId: string, activityPosition: number) {
  const activity = await getActivity({ lessonId, position: activityPosition });

  if (activity?.kind !== "review") {
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
  activityPosition: number,
  lessonSlug: string,
  chapter: { id: string; position: number; course: { id: string } },
  lessonPosition: number,
) {
  const nextActivity = await getNextActivityInCourse({
    activityPosition,
    chapterId: chapter.id,
    chapterPosition: chapter.position,
    courseId: chapter.course.id,
    lessonId,
    lessonPosition,
  });

  const isLastInLesson = !nextActivity || nextActivity.lessonSlug !== lessonSlug;

  if (!isLastInLesson) {
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
