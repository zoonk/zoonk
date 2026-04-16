import { type ActivityScope, findLastCompleted } from "@zoonk/core/activities/last-completed";
import { getSession } from "../users/get-user-session";
import { getNextActivityStateForUser } from "./get-next-activity-state";

export async function getNextActivity({
  scope,
  headers,
}: {
  scope: ActivityScope;
  headers?: Headers;
}): Promise<{
  activityPosition: number;
  brandSlug: string | null;
  canPrefetch: boolean;
  chapterSlug: string;
  completed: boolean;
  courseSlug: string;
  hasStarted: boolean;
  lessonSlug: string;
} | null> {
  const session = await getSession(headers);
  const userId = session?.user.id;
  const lastCompleted = userId ? await findLastCompleted(userId, scope) : null;

  const state = await getNextActivityStateForUser({
    after: lastCompleted
      ? {
          chapterPosition: lastCompleted.chapterPosition,
          lessonId: lastCompleted.lessonId,
          lessonPosition: lastCompleted.lessonPosition,
        }
      : undefined,
    scope,
    userId,
  });

  if (!state) {
    return null;
  }

  return {
    activityPosition: state.activityPosition,
    brandSlug: state.brandSlug,
    canPrefetch: state.canPrefetch,
    chapterSlug: state.chapterSlug,
    completed: state.completed,
    courseSlug: state.courseSlug,
    hasStarted: state.hasStarted,
    lessonSlug: state.lessonSlug,
  };
}
