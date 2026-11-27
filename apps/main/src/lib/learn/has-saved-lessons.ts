import "server-only";
import { listCurrentUserSavedLessons } from "@zoonk/core/saved-lessons/list";

export async function hasSavedLessons(goalId: string): Promise<boolean> {
  const result = await listCurrentUserSavedLessons({ goalId });
  return result.status === "ready" && result.lessons.length > 0;
}
