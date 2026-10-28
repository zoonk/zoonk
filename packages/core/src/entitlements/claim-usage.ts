import "server-only";
import { randomUUID } from "node:crypto";
import { type UsageKind } from "@zoonk/db";
import { revalidateCacheTags } from "../cache/revalidate-cache-tags";
import { getAllowanceCacheTag } from "../cache/tags";
import { claimUsageForViewer } from "./_utils/claim-usage-for-viewer";
import { getEntitlementViewer } from "./_utils/entitlement-viewer";
import { type UsageDecision } from "./contract";

/** Claim immediately before work and obey the decision; targetId makes retries free. Calls may hold fewer seconds than requested. */
export async function claimUsage({
  generated = false,
  kind,
  seconds,
  targetId,
}: {
  generated?: boolean;
  kind: UsageKind;
  seconds?: number;
  targetId: string;
}): Promise<UsageDecision> {
  const viewer = await getEntitlementViewer();

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

/** Claim immediately before starting a small AI call. */
export function claimAssist(): Promise<UsageDecision> {
  return claimUsage({ kind: "assist", targetId: randomUUID() });
}
