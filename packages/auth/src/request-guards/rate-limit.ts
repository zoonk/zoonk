import { captureException, captureMessage } from "@sentry/nextjs";
import { checkRateLimit } from "@vercel/firewall";
import { getEnvironment } from "@zoonk/utils/environment";
import { safeAsync } from "@zoonk/utils/error";
import { logError } from "@zoonk/utils/logger";
import { getAddressKey, getNetworkKey, isNetworkKey } from "./network-key";

/**
 * Rate-limit rule IDs defined in the Vercel Firewall with the `@vercel/firewall` condition. Each
 * rule sets its own window and count in the dashboard, so limits can change without a deploy.
 * Every rule also has a per-address twin (see `getAddressRule`) for network-keyed checks.
 */
export const RATE_LIMIT_RULES = {
  aiUsage: "ai-usage",
  guestSignIn: "guest-sign-in",
  lessonStart: "lesson-start",
  lessonSteps: "lesson-steps",
  reviews: "reviews",
  signUp: "sign-up",
} as const;

export type RateLimitRule = (typeof RATE_LIMIT_RULES)[keyof typeof RATE_LIMIT_RULES];

/**
 * The higher per-address ceiling next to a network-keyed rule (IP and TLS fingerprint): a client
 * that rotates its fingerprint gets a fresh network bucket, but never a fresh address bucket.
 */
function getAddressRule(rule: RateLimitRule): `${RateLimitRule}-ip` {
  return `${rule}-ip`;
}

/**
 * New guests and accounts have no other per-network cap, so in production a missing rule for them
 * blocks the request instead of letting everyone through. Other rules back up a database allowance.
 */
const REQUIRED_RULES = new Set<string>(
  [RATE_LIMIT_RULES.guestSignIn, RATE_LIMIT_RULES.signUp].flatMap((rule) => [
    rule,
    getAddressRule(rule),
  ]),
);

/**
 * Signed-in limits follow the account on any network. Guests are keyed on their network instead,
 * since a bot could otherwise create a fresh guest to reset every limit.
 */
export function getActorRateLimitKey({
  isGuest,
  requestHeaders,
  userId,
}: {
  isGuest: boolean;
  requestHeaders: Headers;
  userId: string;
}): string {
  return isGuest ? getNetworkKey(requestHeaders) : `user:${userId}`;
}

/**
 * The Firewall only answers on Vercel, so E2E servers stand in for it: a request that names a rule
 * in this header is treated as over that rule's limit, which lets HTTP tests reach the 429 path. It
 * can only slow the request that sends it down, so it can't be used to get past a limit.
 */
const E2E_RATE_LIMITED_HEADER = "x-e2e-rate-limited";

function isE2ERateLimited({
  requestHeaders,
  rule,
}: {
  requestHeaders: Headers;
  rule: RateLimitRule;
}): boolean {
  return process.env.E2E_TESTING === "true" && requestHeaders.get(E2E_RATE_LIMITED_HEADER) === rule;
}

/** Rules already reported as missing by this instance, so a misconfiguration is one Sentry issue. */
const reportedMissingRules = new Set<string>();

function reportMissingRule(rule: string) {
  logError(`Rate limit rule ${rule} isn't configured in the Vercel Firewall.`);

  if (!reportedMissingRules.has(rule)) {
    reportedMissingRules.add(rule);
    captureMessage(`Rate limit rule "${rule}" isn't configured in the Vercel Firewall`, "error");
  }
}

/**
 * One rule for one key. A rule missing from the project's Firewall is reported to Sentry and, for
 * the required rules in production, treated as over the limit. A Firewall outage is reported and
 * lets the request through, so a hiccup never locks learners out.
 */
async function isOverRule({
  key,
  requestHeaders,
  rule,
}: {
  key: string;
  requestHeaders: Headers;
  rule: string;
}): Promise<boolean> {
  const { data, error } = await safeAsync(() =>
    checkRateLimit(rule, { headers: requestHeaders, rateLimitKey: key }),
  );

  if (error) {
    logError(`Rate limit check failed for ${rule}:`, error);
    captureException(error);
    return false;
  }

  if (data.error === "not-found") {
    reportMissingRule(rule);
    return REQUIRED_RULES.has(rule) && getEnvironment() === "production";
  }

  return data.rateLimited;
}

/**
 * Checks a Vercel Firewall rate limit for one actor: `user:<id>` for signed-in learners and the
 * network key for guests and sign-ups. A network key is also checked against the rule's
 * per-address twin, so rotating TLS fingerprints can't reset it. Rules only exist on Vercel.
 */
export async function isRateLimited({
  key,
  requestHeaders,
  rule,
}: {
  key: string;
  requestHeaders: Headers;
  rule: RateLimitRule;
}): Promise<boolean> {
  if (process.env.VERCEL !== "1") {
    return isE2ERateLimited({ requestHeaders, rule });
  }

  const checks = isNetworkKey(key)
    ? [
        isOverRule({ key, requestHeaders, rule }),
        isOverRule({
          key: getAddressKey(requestHeaders),
          requestHeaders,
          rule: getAddressRule(rule),
        }),
      ]
    : [isOverRule({ key, requestHeaders, rule })];

  const results = await Promise.all(checks);
  return results.some(Boolean);
}
