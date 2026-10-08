import "server-only";
import { randomUUID } from "node:crypto";
import { RATE_LIMIT_RULES } from "@zoonk/auth/rate-limit";
import { type UsageKind } from "@zoonk/db";
import { revalidateCacheTags } from "../cache/revalidate-cache-tags";
import { getAllowanceCacheTag } from "../cache/tags";
import { isActorRateLimited } from "./_utils/actor-rate-limit";
import { claimUsageForViewer } from "./_utils/claim-usage-for-viewer";
import { getEntitlementViewer } from "./_utils/entitlement-viewer";
import { type UsageDecision } from "./contract";
import { RATE_LIMIT_RETRY_SECONDS } from "./limits";

/**
 * Claims one metered action for the learner or guest in the session before it happens: starting a
 * new lesson (`generated` when its content must be written first), a quick explanation, a new goal,
 * a tutor message, an upload or an AI conversation. Call it right before the work starts and act
 * on the decision; `targetId` is the lesson, explanation, goal, message, upload or conversation.
 * A live call passes the most it may run (`seconds`): the claim holds that much of the day's call
 * time, or what's left of it, and says how much it holds.
 */
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

  const isLimited = await isActorRateLimited({
    isGuest: viewer.isGuest,
    rule: kind === "lessonStart" ? RATE_LIMIT_RULES.lessonStart : RATE_LIMIT_RULES.aiUsage,
    userId: viewer.userId,
  });

  if (isLimited) {
    return { retryAfterSeconds: RATE_LIMIT_RETRY_SECONDS, status: "slowDown" };
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

/**
 * Claims one small AI call for the learner or guest in the session, right before it runs:
 * understanding a goal, an answer's explanation, grading a typed or spoken answer, an example line
 * or a plan edit. Guests get a day's worth, accounts fair use.
 */
export function claimAssist(): Promise<UsageDecision> {
  return claimUsage({ kind: "assist", targetId: randomUUID() });
}
