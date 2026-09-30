import "server-only";
import { gateMemoryFact } from "@zoonk/ai/tasks/v2/memory/gate";
import { type MemoryFact, prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { logError } from "@zoonk/utils/logger";
import { after } from "next/server";
import { revalidateCacheTags } from "../../cache/revalidate-cache-tags";
import { getMemoryCacheTag } from "../../cache/tags";

async function checkSensitivity(fact: MemoryFact): Promise<void> {
  const { data, error } = await safeAsync(() =>
    gateMemoryFact({
      allowSensitive: true,
      candidate: { category: fact.category, evidence: fact.statement, statement: fact.statement },
    }),
  );

  if (error) {
    logError(`Could not check whether memory fact ${fact.id} is sensitive.`, error);
    return;
  }

  if (data.sensitive === fact.sensitive) {
    return;
  }

  // A newer correction wins: the flag only lands on the wording it was checked for.
  const { count } = await prisma.memoryFact.updateMany({
    data: { sensitive: data.sensitive },
    where: { id: fact.id, statement: fact.statement },
  });

  if (count > 0) {
    revalidateCacheTags([getMemoryCacheTag(fact.userId)]);
  }
}

/**
 * A learner can write anything into a fact they correct, health or beliefs included. The fact
 * stays, since they wrote it, but its sensitive flag follows the new wording, so tasks that don't
 * help with such facts stop reading it. The same gate new facts pass checks it after the response.
 */
export function scheduleSensitivityCheck(fact: MemoryFact): void {
  after(() => checkSensitivity(fact));
}
