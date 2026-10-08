import "server-only";
import { type RateLimitRule, getActorRateLimitKey, isRateLimited } from "@zoonk/auth/rate-limit";
import { headers } from "next/headers";

/** Signed-in learners are limited by account; guests by network address and TLS fingerprint. */
export async function isActorRateLimited({
  isGuest,
  rule,
  userId,
}: {
  isGuest: boolean;
  rule: RateLimitRule;
  userId: string;
}): Promise<boolean> {
  const requestHeaders = await headers();

  return isRateLimited({
    key: getActorRateLimitKey({ isGuest, requestHeaders, userId }),
    requestHeaders,
    rule,
  });
}
