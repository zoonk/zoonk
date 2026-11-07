import "server-only";
import { randomUUID } from "node:crypto";
import { type TransactionClient, type UsageKind } from "@zoonk/db";
import { revalidateCacheTags } from "../cache/revalidate-cache-tags";
import { getAllowanceCacheTag } from "../cache/tags";
import { claimUsageForViewer } from "./_utils/claim-usage-for-viewer";
import { claimUsageInTransaction } from "./_utils/claim-usage-in-transaction";
import {
  type EntitlementViewer,
  getEntitlementViewer,
  getEntitlementViewerFor,
} from "./_utils/entitlement-viewer";
import { lockUsageForViewer } from "./_utils/usage-lock";
import { type UsageDecision } from "./contract";

type UsageClaim = { generated?: boolean; kind: UsageKind; seconds?: number; targetId: string };

async function claimAs({
  generated = false,
  kind,
  seconds,
  targetId,
  viewer,
}: UsageClaim & { viewer: EntitlementViewer | null }): Promise<UsageDecision> {
  if (!viewer) {
    return { status: "unauthorized" };
  }

  const decision = await claimUsageForViewer({
    generated,
    kind,
    now: new Date(),
    ...(seconds === undefined ? {} : { seconds }),
    targetId,
    viewer,
  });

  if (decision.status === "allowed") {
    revalidateCacheTags([getAllowanceCacheTag(viewer.userId)]);
  }

  return decision;
}

/** Claim immediately before work and obey the decision; targetId makes retries free. Calls may hold fewer seconds than requested. */
export async function claimUsage(claim: UsageClaim): Promise<UsageDecision> {
  return claimAs({ ...claim, viewer: await getEntitlementViewer() });
}

/** Internal, for workflows: `userId` must come from the learner's own write. */
export async function claimUsageFor({
  userId,
  ...claim
}: UsageClaim & { userId: string }): Promise<UsageDecision> {
  return claimAs({ ...claim, viewer: await getEntitlementViewerFor(userId) });
}

/** Claim immediately before starting a small AI call. */
export function claimAssist(): Promise<UsageDecision> {
  return claimUsage({ kind: "assist", targetId: randomUUID() });
}

/**
 * Claims a small AI call inside the caller's learner write, after the write's own checks, so it's
 * charged only if that write commits. The caller expires the allowance tag once it commits.
 */
export async function claimAssistInWrite({
  transaction,
  viewer,
}: {
  transaction: TransactionClient;
  viewer: EntitlementViewer;
}): Promise<boolean> {
  await lockUsageForViewer({ transaction, userId: viewer.userId });

  const { decision } = await claimUsageInTransaction({
    generated: false,
    kind: "assist",
    now: new Date(),
    targetId: randomUUID(),
    transaction,
    viewer,
  });

  return decision.status === "allowed";
}

/**
 * Claims several uses inside the caller's learner write, stopping at the first refusal, which the
 * caller answers by rolling its write back. They're charged only if that write commits; the caller
 * expires the allowance tag once it does.
 */
export async function claimUsagesInWrite({
  claims,
  transaction,
  viewer,
}: {
  claims: readonly UsageClaim[];
  transaction: TransactionClient;
  viewer: EntitlementViewer;
}): Promise<UsageDecision> {
  await lockUsageForViewer({ transaction, userId: viewer.userId });

  const now = new Date();

  for (const { generated = false, ...claim } of claims) {
    // oxlint-disable-next-line no-await-in-loop -- Each claim counts the ones before it.
    const { decision } = await claimUsageInTransaction({
      ...claim,
      generated,
      now,
      transaction,
      viewer,
    });

    if (decision.status !== "allowed") {
      return decision;
    }
  }

  return { status: "allowed" };
}
