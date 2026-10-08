import "server-only";
import { prisma } from "@zoonk/db";
import { revalidateCacheTags } from "../../cache/revalidate-cache-tags";
import { getLearningProfileCacheTag, getMemoryCacheTag } from "../../cache/tags";
import { forgetExampleLines } from "../../memory/_utils/forget-example-lines";
import { findGuardedLink } from "./_utils/guarded-link";

/**
 * The guardian turns the learner's memory off, or lets the learner choose again (ECA Digital art.
 * 18: guardians see and manage a minor's privacy options). While any active link keeps it off,
 * Zoonk learns nothing new and uses nothing it remembers, and the learner can't turn it on; their
 * facts stay listed for them to see or delete. The example lines written from them go.
 */
export async function setGuardianMemory({
  linkId,
  memoryOff,
}: {
  linkId: string;
  memoryOff: boolean;
}): Promise<{ status: "notFound" | "unauthorized" | "updated" }> {
  const { link, signedIn } = await findGuardedLink(linkId);

  if (!signedIn) {
    return { status: "unauthorized" };
  }

  if (!link) {
    return { status: "notFound" };
  }

  await prisma.guardianLink.update({ data: { memoryOff }, where: { id: link.id } });

  if (memoryOff) {
    await forgetExampleLines({ userId: link.userId });
  }

  revalidateCacheTags([getMemoryCacheTag(link.userId), getLearningProfileCacheTag(link.userId)]);

  return { status: "updated" };
}
