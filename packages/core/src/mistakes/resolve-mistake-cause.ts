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

/** Model failures leave cause unset; a cause saved meanwhile must never be overwritten. */
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

/** Pass the request returned by answer recording; schedules classification after the response. */
export function scheduleMistakeCause(request: MistakeCauseRequest | null): void {
  if (request) {
    after(() => resolveMistakeCause(request));
  }
}
