import "server-only";
import { listCurrentUserCompletedLessons } from "@zoonk/core/completed-lessons/list-current-user";

export async function hasCompletedLessons(goalId: string): Promise<boolean> {
  const result = await listCurrentUserCompletedLessons({ goalId, limit: 1, offset: 0 });
  return result.status === "ready" && result.lessons.length > 0;
}
