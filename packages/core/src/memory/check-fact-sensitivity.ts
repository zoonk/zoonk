import "server-only";
import { gateMemoryFact } from "@zoonk/ai/tasks/memory/gate";
import { prisma } from "@zoonk/db";
import { revalidateCacheTags } from "../cache/revalidate-cache-tags";
import { getMemoryCacheTag } from "../cache/tags";

/**
 * Internal, for the follow-up a learner's correction owes. A newer correction wins: the flag only
 * lands on the wording it was checked for. A model failure throws, so the step retries.
 */
export async function checkFactSensitivity({
  factId,
  statement,
}: {
  factId: string;
  statement: string;
}): Promise<void> {
  const fact = await prisma.memoryFact.findFirst({ where: { id: factId, statement } });

  if (!fact) {
    return;
  }

  const verdict = await gateMemoryFact({
    candidate: { category: fact.category, evidence: statement, statement },
  });

  if (verdict.sensitive === fact.sensitive) {
    return;
  }

  const { count } = await prisma.memoryFact.updateMany({
    data: { sensitive: verdict.sensitive },
    where: { id: factId, statement },
  });

  if (count > 0) {
    revalidateCacheTags([getMemoryCacheTag(fact.userId)]);
  }
}
