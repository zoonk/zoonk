import "server-only";
import { revalidateCacheTags } from "../cache/revalidate-cache-tags";
import { getMemoryCacheTag } from "../cache/tags";
import { unchanged, writeLearnerChange } from "../learner/_utils/write-learner-change";
import { getSession } from "../users/get-session";
import { forgetExampleLines } from "./_utils/forget-example-lines";
import { type MemorySettingsUpdateInput } from "./memory-contract";

/**
 * Turns memory on or off. Off, Zoonk stops learning new facts and tasks stop reading them, while the
 * facts stay listed so the learner can still edit, delete or export them; the example lines written
 * from them go, since lessons stop showing them. Returns whether memory is on now.
 */
export async function updateMemorySettings(
  input: MemorySettingsUpdateInput,
): Promise<{ enabled: boolean; status: "updated" } | { status: "unauthorized" }> {
  const session = await getSession();

  if (!session) {
    return { status: "unauthorized" };
  }

  const userId = session.user.id;

  const changed = await writeLearnerChange({ userId }, async (tx) => {
    // Read under the learner's lock, so a concurrent switch can't make this one look unchanged.
    const profile = await tx.userLearningProfile.findUnique({ where: { userId } });

    // Memory is on until the learner turns it off; asking for what it already is changes nothing.
    if ((profile?.memoryEnabled ?? true) === input.enabled) {
      return unchanged(false);
    }

    await tx.userLearningProfile.upsert({
      create: { memoryEnabled: input.enabled, userId },
      update: { memoryEnabled: input.enabled },
      where: { userId },
    });

    if (!input.enabled) {
      await forgetExampleLines({ client: tx, userId });
    }

    return true;
  });

  if (changed) {
    revalidateCacheTags([getMemoryCacheTag(userId)]);
  }

  return { enabled: input.enabled, status: "updated" };
}
