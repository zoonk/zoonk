import "server-only";
import { prisma } from "@zoonk/db";
import { isUuid } from "@zoonk/utils/uuid";
import { revalidateCacheTags } from "../cache/revalidate-cache-tags";
import { getSavedLessonsCacheTag } from "../cache/tags";
import { findOwnedGoal } from "../learner/_utils/owned-goal";
import { findStartableLesson } from "../lesson-player/_utils/lesson-rows";
import { type SaveLessonInput } from "./contract";

export type SaveLessonResult =
  | { saved: boolean; status: "ready" }
  | { status: "notFound" | "unauthorized" };

export async function saveLesson({
  goalId,
  lessonId,
  saved,
}: SaveLessonInput & { goalId: string }): Promise<SaveLessonResult> {
  const owned = await findOwnedGoal(goalId);

  if (owned.status !== "ready") {
    return owned;
  }

  if (!isUuid(lessonId)) {
    return { status: "notFound" };
  }

  const { userId } = owned;

  if (!saved) {
    await prisma.savedLesson.deleteMany({ where: { lessonId, userId } });
    revalidateCacheTags([getSavedLessonsCacheTag(userId)]);
    return { saved: false, status: "ready" };
  }

  const lesson = await findStartableLesson({ lessonId, userId });

  if (!lesson) {
    return { status: "notFound" };
  }

  await prisma.savedLesson.createMany({
    data: [{ goalId: owned.goal.id, lessonId, title: lesson.title, userId }],
    skipDuplicates: true,
  });

  revalidateCacheTags([getSavedLessonsCacheTag(userId)]);
  return { saved: true, status: "ready" };
}
