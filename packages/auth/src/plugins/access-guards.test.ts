import { checkRateLimit } from "@vercel/firewall";
import { prisma } from "@zoonk/db";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createExistingAccount,
  createTestEmail,
  guestAuth,
  signInAsGuest,
  signUp,
} from "../guests/_test-utils/guest-auth";

/** The Vercel Firewall only answers on Vercel, so tests stand in for its verdicts (BotID: `bot-check.test.ts`). */
vi.mock("@vercel/firewall", () => ({ checkRateLimit: vi.fn() }));

/** Checkout must be blocked before any request reaches Stripe. */
const stripeMocks = vi.hoisted(() => ({ create: vi.fn(), search: vi.fn() }));

vi.mock("../stripe/client", () => ({
  stripeClient: {
    checkout: { sessions: { create: stripeMocks.create } },
    customers: { create: stripeMocks.create, search: stripeMocks.search },
    prices: { list: stripeMocks.search },
  },
}));

const TEEN_BIRTH = { birthMonth: 1, birthYear: 2011 };
const UPGRADE_BODY = { cancelUrl: "/", plan: "plus", successUrl: "/" };

function limitRule(rule: string) {
  vi.mocked(checkRateLimit).mockImplementation(async (id) => ({ rateLimited: id === rule }));
}

describe("access guards", () => {
  beforeEach(() => {
    vi.stubEnv("VERCEL", "1");
    vi.mocked(checkRateLimit).mockResolvedValue({ rateLimited: false });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("caps new guests per network and browser fingerprint", async () => {
    limitRule("guest-sign-in");

    const requestHeaders = new Headers({
      "x-real-ip": "203.0.113.7",
      "x-vercel-ja4-digest": "t13d1516h2_8daaf6152771_02713d6af862",
    });

    await expect(guestAuth.api.signInAnonymous({ headers: requestHeaders })).rejects.toMatchObject({
      body: { code: "GUEST_SIGN_IN_LIMIT_REACHED" },
      statusCode: 429,
    });

    expect(checkRateLimit).toHaveBeenCalledWith(
      "guest-sign-in",
      expect.objectContaining({ rateLimitKey: expect.stringMatching(/^network:[0-9a-f]{32}$/u) }),
    );
  });

  it("caps new accounts per network without blocking existing sign-ins", async () => {
    const account = await createExistingAccount({ createdAt: new Date() });
    const email = createTestEmail();

    limitRule("sign-up");

    await expect(signUp({ email })).rejects.toMatchObject({
      body: { code: "SIGN_UP_LIMIT_REACHED" },
      statusCode: 429,
    });

    await expect(prisma.user.findUnique({ where: { email } })).resolves.toBeNull();

    await expect(
      guestAuth.api.signInEmail({
        body: { email: account.email, password: "guest-test-password" },
      }),
    ).resolves.toMatchObject({ user: { id: account.userId } });
  });

  it("asks guests to create an account before checkout", async () => {
    const { headers } = await signInAsGuest();

    await expect(
      guestAuth.api.upgradeSubscription({ body: UPGRADE_BODY, headers }),
    ).rejects.toMatchObject({ body: { code: "GUEST_PURCHASE_NOT_ALLOWED" }, statusCode: 403 });

    expect(stripeMocks.create).not.toHaveBeenCalled();
  });

  it("stops checkout for a learner under 18 until a guardian approves Plus", async () => {
    const account = await createExistingAccount({ createdAt: new Date() });
    await prisma.userLearningProfile.create({ data: { ...TEEN_BIRTH, userId: account.userId } });

    const { headers } = await guestAuth.api.signInEmail({
      body: { email: account.email, password: "guest-test-password" },
      returnHeaders: true,
    });

    const cookie = headers
      .getSetCookie()
      .map((value) => value.split(";")[0])
      .join("; ");

    await expect(
      guestAuth.api.upgradeSubscription({ body: UPGRADE_BODY, headers: new Headers({ cookie }) }),
    ).rejects.toMatchObject({ body: { code: "GUARDIAN_APPROVAL_REQUIRED" }, statusCode: 403 });

    expect(stripeMocks.create).not.toHaveBeenCalled();
  });
});
