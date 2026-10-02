import "server-only";
import { RATE_LIMIT_RULES } from "@zoonk/auth/rate-limit";
import { getSession } from "../users/get-session";
import { isActorRateLimited } from "./_utils/actor-rate-limit";
import { type UsageDecision } from "./contract";
import { RATE_LIMIT_RETRY_SECONDS } from "./limits";

/**
 * Reviews and mistake practice never stop at a hard wall. Only unusual volume, as the firewall
 * rule defines it, asks the learner to wait a moment before the next review.
 */
export async function checkReviewPace(): Promise<UsageDecision> {
  const session = await getSession();

  if (!session) {
    return { status: "unauthorized" };
  }

  const isLimited = await isActorRateLimited({
    isGuest: Boolean(session.user.isAnonymous),
    rule: RATE_LIMIT_RULES.reviews,
    userId: session.user.id,
  });

  return isLimited
    ? { retryAfterSeconds: RATE_LIMIT_RETRY_SECONDS, status: "slowDown" }
    : { status: "allowed" };
}
