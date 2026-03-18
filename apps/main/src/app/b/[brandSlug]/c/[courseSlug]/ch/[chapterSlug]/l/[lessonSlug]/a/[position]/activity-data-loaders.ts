import { getActivity } from "@/data/activities/get-activity";
import { getReviewSteps } from "@/data/activities/get-review-steps";
import { getNextSibling } from "@/data/progress/get-next-sibling";
import { getNextActivityInCourse } from "@zoonk/core/activities/next-in-course";
import { getSession } from "@zoonk/core/users/session/get";

export async function fetchReviewSteps(lessonId: number, activityPosition: number) {
  const activity = await getActivity({ lessonId, position: activityPosition });

  if (activity?.kind !== "review") {
    return null;
  }

  const session = await getSession();

  return getReviewSteps({
    lessonId,
    userId: session ? Number(session.user.id) : null,
  });
}

export async function fetchNextSibling(
  lessonId: number,
  activityPosition: number,
  lessonSlug: string,
  chapter: { id: number; position: number; course: { id: number } },
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
