import "server-only";
import { classifyMistakeCause } from "@zoonk/ai/tasks/v2/mistakes/cause";
import { type MistakeCause } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { logError } from "@zoonk/utils/logger";
import { after } from "next/server";
import { revalidateCacheTags } from "../cache/revalidate-cache-tags";
import { getLearnerModelCacheTag } from "../cache/tags";
import { unchanged, writeLearnerChange } from "../learner/_utils/write-learner-change";
import { type MistakeCauseRequest } from "./record-mistake";

/**
 * Asks the classifier for the cause of an ambiguous mistake and stores it. The entry keeps an
 * empty cause when the model fails, and a cause set meanwhile (by a person or a later answer) is
 * never overwritten.
 */
async function resolveMistakeCause({
  input,
  mistakeId,
  userId,
}: MistakeCauseRequest): Promise<MistakeCause | null> {
  const { data, error } = await safeAsync(() =>
    classifyMistakeCause({ ...input, analytics: { contentScope: "personal", distinctId: userId } }),
  );

  if (error) {
    logError(`Could not classify the cause of mistake ${mistakeId}.`, error);
    return null;
  }

  const { cause } = data.data;

  // The notebook shows the cause; one set meanwhile stays, and changes nothing.
  const saved = await writeLearnerChange({ userId }, async (tx) => {
    const { count } = await tx.mistake.updateMany({
      data: { cause },
      where: { cause: null, id: mistakeId },
    });

    return count > 0 ? cause : unchanged(null);
  });

  if (saved) {
    revalidateCacheTags([getLearnerModelCacheTag(userId)]);
  }

  return saved;
}

/**
 * Runs the cause classifier after the response is sent, so the learner sees feedback right away.
 * Capabilities that record answers call this with the request `recordLearnerAnswer` returned.
 */
export function scheduleMistakeCause(request: MistakeCauseRequest | null): void {
  if (request) {
    after(() => resolveMistakeCause(request));
  }
}
