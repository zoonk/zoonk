import "server-only";
import { type MemoryFact } from "@zoonk/db";
import { isUuid } from "@zoonk/utils/uuid";
import { after } from "next/server";
import { trackLearnerEvents } from "../analytics/track-learner-event";
import { revalidateCacheTags } from "../cache/revalidate-cache-tags";
import { getAllowanceCacheTag, getMemoryCacheTag } from "../cache/tags";
import { getEntitlementViewer } from "../entitlements/_utils/entitlement-viewer";
import { claimAssistInWrite } from "../entitlements/claim-usage";
import { oweFollowUps } from "../follow-ups/owe-follow-ups";
import { unchanged, writeLearnerChange } from "../learner/_utils/write-learner-change";
import { getSession } from "../users/get-session";
import { forgetExampleLines } from "./_utils/forget-example-lines";
import { LEARNER_CONFIDENCE } from "./_utils/memory-candidates";
import { toMemoryFactView } from "./_utils/memory-fact-view";
import { type MemoryFactUpdateInput, type MemoryFactView } from "./memory-contract";

function isSameCorrection({
  fact,
  input,
}: {
  fact: Pick<MemoryFact, "category" | "confidence" | "origin" | "statement">;
  input: MemoryFactUpdateInput;
}): boolean {
  return (
    fact.origin === "said" &&
    fact.confidence === LEARNER_CONFIDENCE &&
    (input.category === undefined || input.category === fact.category) &&
    (input.statement === undefined || input.statement === fact.statement)
  );
}

export type MemoryFactUpdateResult =
  | { fact: MemoryFactView; status: "updated" }
  | { status: "notFound" | "unauthorized" };

/**
 * Saves in place, so the old wording isn't kept anywhere. A reworded fact stays out of tasks that
 * leave sensitive facts out until its check clears it, and gets no check past the learner's small
 * AI help.
 */
export async function updateMemoryFact({
  factId,
  input,
}: {
  factId: string;
  input: MemoryFactUpdateInput;
}): Promise<MemoryFactUpdateResult> {
  const session = await getSession();

  if (!session) {
    return { status: "unauthorized" };
  }

  if (!isUuid(factId)) {
    return { status: "notFound" };
  }

  const userId = session.user.id;
  const viewer = input.statement === undefined ? null : await getEntitlementViewer();

  const saved = await writeLearnerChange({ userId }, async (tx) => {
    const existing = await tx.memoryFact.findFirst({
      where: { id: factId, status: "active", userId },
    });

    if (!existing) {
      return unchanged(null);
    }

    if (isSameCorrection({ fact: existing, input })) {
      return unchanged({ changed: false, checked: false, fact: existing, previous: existing });
    }

    const reworded = input.statement !== undefined && input.statement !== existing.statement;

    const checked =
      reworded && viewer !== null && (await claimAssistInWrite({ transaction: tx, viewer }));

    const updated = await tx.memoryFact.update({
      data: {
        category: input.category,
        confidence: LEARNER_CONFIDENCE,
        origin: "said",
        statement: input.statement,
        ...(reworded ? { sensitive: true } : {}),
      },
      where: { id: factId },
    });

    if (reworded) {
      await forgetExampleLines({ client: tx, userId });
    }

    if (checked) {
      await oweFollowUps({
        db: tx,
        followUps: [
          { input: { factId, statement: updated.statement }, kind: "checkFactSensitivity" },
        ],
        userId,
      });
    }

    return { changed: true, checked, fact: updated, previous: existing };
  });

  if (!saved) {
    return { status: "notFound" };
  }

  if (saved.changed) {
    const previous = toMemoryFactView(saved.previous);

    after(() =>
      trackLearnerEvents({
        events: [
          {
            name: "Memory Updated",
            properties: { category: previous.category, change: "updated", origin: previous.origin },
          },
        ],
        userId,
      }),
    );

    revalidateCacheTags([
      getMemoryCacheTag(userId),
      ...(saved.checked ? [getAllowanceCacheTag(userId)] : []),
    ]);
  }

  return { fact: toMemoryFactView(saved.fact), status: "updated" };
}
