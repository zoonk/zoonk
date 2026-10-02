import "server-only";
import { prisma } from "@zoonk/db";
import { revalidateCacheTags } from "../cache/revalidate-cache-tags";
import { getMemoryCacheTag } from "../cache/tags";
import { getSession } from "../users/get-session";
import { type MemorySettingsUpdateInput } from "./memory-contract";

/**
 * Turns memory on or off. Off, Zoonk stops learning new facts and tasks stop reading them, while
 * the facts stay listed so the learner can still edit, delete or export them.
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

  revalidateCacheTags([getMemoryCacheTag(userId)]);

  return { enabled: input.enabled, status: "updated" };
}
