import "server-only";
import { randomUUID } from "node:crypto";
import { type UsageKind } from "@zoonk/db";
import { revalidateCacheTags } from "../cache/revalidate-cache-tags";
import { getAllowanceCacheTag } from "../cache/tags";
import { claimUsageForViewer } from "./_utils/claim-usage-for-viewer";
import {
  type EntitlementViewer,
  getEntitlementViewer,
  getEntitlementViewerFor,
} from "./_utils/entitlement-viewer";
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
