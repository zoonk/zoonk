import "server-only";
import { isUuid } from "@zoonk/utils/uuid";
import { getWarmUp } from "../library/warm-ups/get-warm-up";
import { type WarmUpDeck } from "../library/warm-ups/warm-up-contract";
import { getSession } from "../users/get-session";
import { findFirstLessonWarmUp } from "./_utils/first-lesson-warm-up";

/** The deck a lesson's wait shows: its goal's, and only while that is the goal's first lesson. */
export async function getFirstLessonWarmUp({
  lessonId,
}: {
  lessonId: string;
}): Promise<WarmUpDeck | null> {
  const session = await getSession();

  if (!session || !isUuid(lessonId)) {
    return null;
  }

  const warmUpId = await findFirstLessonWarmUp({ lessonId, userId: session.user.id });

  if (!warmUpId) {
    return null;
  }

  const result = await getWarmUp(warmUpId);
  return result.status === "ready" ? result.deck : null;
}
