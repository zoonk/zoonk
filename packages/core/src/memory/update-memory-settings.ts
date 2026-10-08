import "server-only";
import { prisma } from "@zoonk/db";
import { revalidateCacheTags } from "../cache/revalidate-cache-tags";
import { getMemoryCacheTag } from "../cache/tags";
import { getSession } from "../users/get-session";
import { forgetExampleLines } from "./_utils/forget-example-lines";
import { getMemoryAccess } from "./_utils/memory-access";
import { type MemorySettingsUpdateInput } from "./memory-contract";

/**
 * Turns memory on or off: the learner's own choice, which replaces their age's default (on only
 * for adults). Off, Zoonk stops learning new facts and tasks stop reading them, while the facts stay
 * listed so the learner can still edit, delete or export them; the example lines written from them
 * go, since lessons stop showing them. Returns whether memory is on now, which stays off while a
 * guardian turned it off.
 */
export async function updateMemorySettings(
  input: MemorySettingsUpdateInput,
): Promise<{ enabled: boolean; status: "updated" } | { status: "unauthorized" }> {
  const session = await getSession();

  if (!session) {
    return { status: "unauthorized" };
  }

  const userId = session.user.id;

  await prisma.userLearningProfile.upsert({
    create: { memoryEnabled: input.enabled, userId },
    update: { memoryEnabled: input.enabled },
    where: { userId },
  });

  if (!input.enabled) {
    await forgetExampleLines({ userId });
  }

  revalidateCacheTags([getMemoryCacheTag(userId)]);

  const access = await getMemoryAccess(userId);

  return { enabled: access.enabled, status: "updated" };
}
