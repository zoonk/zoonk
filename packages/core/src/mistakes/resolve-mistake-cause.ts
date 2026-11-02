import "server-only";
import { type MistakeCauseInput, classifyMistakeCause } from "@zoonk/ai/tasks/mistakes/cause";
import { type MistakeCause } from "@zoonk/db";
import { revalidateCacheTags } from "../cache/revalidate-cache-tags";
import { getLearnerModelCacheTag } from "../cache/tags";
import { unchanged, writeLearnerChange } from "../learner/_utils/write-learner-change";

/**
 * Internal, for the follow-up that answer recording owes. A cause saved meanwhile is never
 * overwritten; a model failure throws, so the step retries.
 */
export async function resolveMistakeCause({
  cause: input,
  mistakeId,
  userId,
}: {
  cause: MistakeCauseInput;
  mistakeId: string;
  userId: string;
}): Promise<MistakeCause | null> {
  const { data } = await classifyMistakeCause({
    ...input,
    analytics: { contentScope: "personal", distinctId: userId },
  });

  const saved = await writeLearnerChange({ userId }, async (tx) => {
    const { count } = await tx.mistake.updateMany({
      data: { cause: data.cause },
      where: { cause: null, id: mistakeId },
    });

    return count > 0 ? data.cause : unchanged(null);
  });

  if (saved) {
    revalidateCacheTags([getLearnerModelCacheTag(userId)]);
  }

  return saved;
}
