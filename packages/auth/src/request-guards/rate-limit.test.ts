import { captureException, captureMessage } from "@sentry/nextjs";
import { checkRateLimit } from "@vercel/firewall";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getAddressKey, getNetworkKey } from "./network-key";
import { RATE_LIMIT_RULES, isRateLimited } from "./rate-limit";

/** The Firewall only answers on Vercel, and Sentry only reports there, so tests stand in for both. */
vi.mock("@vercel/firewall", () => ({ checkRateLimit: vi.fn() }));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn(), captureMessage: vi.fn() }));

const OVER_LIMIT_HEADER = "x-e2e-rate-limited";

const NETWORK = new Headers({
  "x-real-ip": "203.0.113.7",
  "x-vercel-ja4-digest": "t13d1516h2_8daaf6152771_02713d6af862",
});

function check(headers: Record<string, string>) {
  return isRateLimited({
    key: "user:learner",
    requestHeaders: new Headers(headers),
    rule: RATE_LIMIT_RULES.lessonSteps,
  });
}

function checkNetwork(rule: (typeof RATE_LIMIT_RULES)[keyof typeof RATE_LIMIT_RULES]) {
  return isRateLimited({ key: getNetworkKey(NETWORK), requestHeaders: NETWORK, rule });
}

/** Answers each rule as the Firewall would: over the limit, missing, or under it. */
function answerRules({ missing = [], over = [] }: { missing?: string[]; over?: string[] }) {
  vi.mocked(checkRateLimit).mockImplementation(async (rule) => {
    if (missing.includes(rule)) {
      return { error: "not-found", rateLimited: false };
    }

    return { rateLimited: over.includes(rule) };
  });
}

describe(isRateLimited, () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("never limits off Vercel, whatever the request says", async () => {
    vi.stubEnv("VERCEL", "");
    vi.stubEnv("E2E_TESTING", "false");

    await expect(check({ [OVER_LIMIT_HEADER]: RATE_LIMIT_RULES.lessonSteps })).resolves.toBe(false);
  });

  it("lets an E2E request stand in for the Firewall, for the rule it names only", async () => {
    vi.stubEnv("VERCEL", "");
    vi.stubEnv("E2E_TESTING", "true");

    await expect(check({ [OVER_LIMIT_HEADER]: RATE_LIMIT_RULES.lessonSteps })).resolves.toBe(true);
    await expect(check({ [OVER_LIMIT_HEADER]: RATE_LIMIT_RULES.lessonStart })).resolves.toBe(false);
    await expect(check({})).resolves.toBe(false);
  });

  describe("on Vercel", () => {
    beforeEach(() => {
      vi.clearAllMocks();
      vi.stubEnv("VERCEL", "1");
      vi.stubEnv("VERCEL_ENV", "production");
      vi.stubEnv("E2E_TESTING", "false");
      answerRules({});
    });

    it("backs a network key with its rule's per-address ceiling", async () => {
      await expect(checkNetwork(RATE_LIMIT_RULES.guestSignIn)).resolves.toBe(false);

      expect(checkRateLimit).toHaveBeenCalledWith(
        "guest-sign-in",
        expect.objectContaining({ rateLimitKey: getNetworkKey(NETWORK) }),
      );

      expect(checkRateLimit).toHaveBeenCalledWith(
        "guest-sign-in-ip",
        expect.objectContaining({ rateLimitKey: getAddressKey(NETWORK) }),
      );
    });

    it("limits a client that rotates its TLS fingerprint once its address is over", async () => {
      answerRules({ over: ["ai-usage-ip"] });

      await expect(checkNetwork(RATE_LIMIT_RULES.aiUsage)).resolves.toBe(true);
    });

    it("keeps an account's limit to its own rule", async () => {
      await expect(check({})).resolves.toBe(false);

      expect(checkRateLimit).toHaveBeenCalledExactlyOnceWith(
        "lesson-steps",
        expect.objectContaining({ rateLimitKey: "user:learner" }),
      );
    });

    it("blocks new guests and accounts in production when their rule is missing, and says so", async () => {
      answerRules({ missing: ["guest-sign-in", "sign-up-ip"] });

      await expect(checkNetwork(RATE_LIMIT_RULES.guestSignIn)).resolves.toBe(true);
      await expect(checkNetwork(RATE_LIMIT_RULES.signUp)).resolves.toBe(true);

      expect(captureMessage).toHaveBeenCalledWith(
        expect.stringContaining('"guest-sign-in"'),
        "error",
      );

      expect(captureMessage).toHaveBeenCalledWith(expect.stringContaining('"sign-up-ip"'), "error");
    });

    it("lets other rules through when missing, but still says so", async () => {
      answerRules({ missing: ["lesson-start"] });

      await expect(checkNetwork(RATE_LIMIT_RULES.lessonStart)).resolves.toBe(false);

      expect(captureMessage).toHaveBeenCalledWith(
        expect.stringContaining('"lesson-start"'),
        "error",
      );
    });

    it("never blocks a preview for a missing rule", async () => {
      vi.stubEnv("VERCEL_ENV", "preview");
      answerRules({ missing: ["guest-sign-in", "guest-sign-in-ip"] });

      await expect(checkNetwork(RATE_LIMIT_RULES.guestSignIn)).resolves.toBe(false);
    });

    it("lets requests through a Firewall outage and reports it", async () => {
      const outage = new Error("Unexpected rate-limit API response status");
      vi.mocked(checkRateLimit).mockRejectedValue(outage);

      await expect(checkNetwork(RATE_LIMIT_RULES.signUp)).resolves.toBe(false);
      expect(captureException).toHaveBeenCalledWith(outage);
    });
  });
});
