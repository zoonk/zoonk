import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { betterAuth } from "better-auth/minimal";
import { describe, expect, it } from "vitest";
import { rememberHomeCountryAfterSessionCreate } from "./db-hooks";
import { createTestEmail, guestAuth, toCookieHeaders } from "./guests/_test-utils/guest-auth";
import { baseAuthConfig } from "./server";

const auth = betterAuth({
  ...baseAuthConfig,
  baseURL: "http://localhost:3000",
  emailAndPassword: { enabled: true },
  rateLimit: { enabled: false },
  secret: "home-country-test-secret-with-enough-entropy",
});

const PASSWORD = "test-password-12345";

async function signUp(headers: Record<string, string>) {
  const email = `${randomUUID()}@example.test`;

  const result = await auth.api.signUpEmail({
    body: { email, name: "Home", password: PASSWORD },
    headers: new Headers(headers),
  });

  return { email, userId: result.user.id };
}

const GUEST_SETTINGS = {
  buddyGlasses: "star",
  buddyKind: "zu",
  buddyName: "Pip",
  learningNeeds: ["stepByStep"],
  memoryEnabled: false,
  shareUsageData: true,
  soundsEnabled: false,
} as const;

/** A guest with every setting a sign-up carries over turned away from its default. */
async function guestWithSettings(settings: { homeCountry?: string; memoryEnabled?: boolean } = {}) {
  const guest = await guestAuth.api.signInAnonymous({ returnHeaders: true });

  await prisma.userLearningProfile.create({
    data: {
      ...GUEST_SETTINGS,
      learningNeeds: [...GUEST_SETTINGS.learningNeeds],
      ...settings,
      userId: guest.response.user.id,
    },
  });

  return toCookieHeaders(guest.headers);
}

async function homeCountry(userId: string) {
  const profile = await prisma.userLearningProfile.findUnique({ where: { userId } });
  return profile?.homeCountry ?? null;
}

describe("home country from the sign-in's location", () => {
  it("saves the IP's country when a learner signs up", async () => {
    const { userId } = await signUp({ "x-vercel-ip-country": "BR" });

    await expect(homeCountry(userId)).resolves.toBe("BR");
  });

  it.each([
    { header: ["accept-language", "pt-BR"], reason: "the browser's language" },
    { header: ["x-vercel-ip-country", "ZZ"], reason: "a code that isn't a country" },
    { header: ["x-forwarded-for", "203.0.113.10"], reason: "an address with no country" },
  ] as const)("saves nothing from $reason", async ({ header: [name, value] }) => {
    const { userId } = await signUp({ [name]: value });

    await expect(homeCountry(userId)).resolves.toBeNull();
  });

  it("fills an empty country at the next sign-in and keeps the other settings", async () => {
    const { email, userId } = await signUp({});
    await prisma.userLearningProfile.create({ data: { soundsEnabled: false, userId } });

    await auth.api.signInEmail({
      body: { email, password: PASSWORD },
      headers: new Headers({ "x-vercel-ip-country": "DE" }),
    });

    await expect(
      prisma.userLearningProfile.findUniqueOrThrow({ where: { userId } }),
    ).resolves.toMatchObject({ homeCountry: "DE", soundsEnabled: false });
  });

  it("keeps the country a learner has when they sign in from somewhere else", async () => {
    const { email, userId } = await signUp({ "x-vercel-ip-country": "BR" });

    await auth.api.signInEmail({
      body: { email, password: PASSWORD },
      headers: new Headers({ "x-vercel-ip-country": "US" }),
    });

    await expect(homeCountry(userId)).resolves.toBe("BR");
  });

  it("saves nothing when staff open a learner's account", async () => {
    const { userId } = await signUp({});

    await rememberHomeCountryAfterSessionCreate(
      { impersonatedBy: randomUUID(), userId },
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the hook reads only the headers.
      { headers: new Headers({ "x-vercel-ip-country": "US" }) } as Parameters<
        typeof rememberHomeCountryAfterSessionCreate
      >[1],
    );

    await expect(homeCountry(userId)).resolves.toBeNull();
  });

  it("keeps the country a guest picked when they create an account somewhere else", async () => {
    const guest = await guestAuth.api.signInAnonymous({ returnHeaders: true });
    const guestId = guest.response.user.id;
    await prisma.userLearningProfile.create({ data: { homeCountry: "BR", userId: guestId } });

    const headers = toCookieHeaders(guest.headers);
    headers.set("x-vercel-ip-country", "US");

    const account = await guestAuth.api.signUpEmail({
      body: { email: createTestEmail(), name: "Home", password: PASSWORD },
      headers,
    });

    await expect(homeCountry(account.user.id)).resolves.toBe("BR");
  });

  it.each([{ country: "US" }, { country: null }])(
    "carries a guest's settings into the account they create (country $country)",
    async ({ country }) => {
      const headers = await guestWithSettings();

      if (country) {
        headers.set("x-vercel-ip-country", country);
      }

      const account = await guestAuth.api.signUpEmail({
        body: { email: createTestEmail(), name: "Home", password: PASSWORD },
        headers,
      });

      await expect(
        prisma.userLearningProfile.findUniqueOrThrow({ where: { userId: account.user.id } }),
      ).resolves.toMatchObject({ ...GUEST_SETTINGS, homeCountry: country });
    },
  );

  it.each([
    { account: true, guest: false },
    { account: false, guest: true },
  ])(
    "keeps an existing account's Memory ($account) when it signs in from a guest ($guest)",
    async ({ account, guest }) => {
      const email = createTestEmail();

      const created = await guestAuth.api.signUpEmail({
        body: { email, name: "Home", password: PASSWORD },
      });

      await prisma.userLearningProfile.create({
        data: { memoryEnabled: account, userId: created.user.id },
      });

      const headers = await guestWithSettings({ memoryEnabled: guest });
      headers.set("x-vercel-ip-country", "US");

      await guestAuth.api.signInEmail({ body: { email, password: PASSWORD }, headers });

      await expect(
        prisma.userLearningProfile.findUniqueOrThrow({ where: { userId: created.user.id } }),
      ).resolves.toMatchObject({ homeCountry: "US", memoryEnabled: account });
    },
  );

  it("keeps what an account set in the session a one-time token signs in with", async () => {
    const account = await guestAuth.api.signUpEmail({
      body: { email: createTestEmail(), name: "Home", password: PASSWORD },
      returnHeaders: true,
    });

    const userId = account.response.user.id;

    await prisma.userLearningProfile.create({
      data: {
        buddyKind: "zu",
        buddyName: "Account",
        memoryEnabled: false,
        soundsEnabled: false,
        userId,
      },
    });

    const { token } = await guestAuth.api.generateOneTimeToken({
      headers: toCookieHeaders(account.headers),
    });

    await guestAuth.api.verifyOneTimeToken({
      body: { token },
      headers: await guestWithSettings({ memoryEnabled: true }),
    });

    await expect(
      prisma.userLearningProfile.findUniqueOrThrow({ where: { userId } }),
    ).resolves.toMatchObject({ buddyName: "Account", memoryEnabled: false, soundsEnabled: false });
  });

  it("carries a guest's settings through a one-time token into a country-only account", async () => {
    const account = await guestAuth.api.signUpEmail({
      body: { email: createTestEmail(), name: "Home", password: PASSWORD },
      headers: new Headers({ "x-vercel-ip-country": "US" }),
      returnHeaders: true,
    });

    const { token } = await guestAuth.api.generateOneTimeToken({
      headers: toCookieHeaders(account.headers),
    });

    await guestAuth.api.verifyOneTimeToken({ body: { token }, headers: await guestWithSettings() });

    await expect(
      prisma.userLearningProfile.findUniqueOrThrow({ where: { userId: account.response.user.id } }),
    ).resolves.toMatchObject({ ...GUEST_SETTINGS, homeCountry: "US" });
  });

  it("keeps an untouched profile from an earlier session when it signs in from a guest", async () => {
    const email = createTestEmail();

    const created = await guestAuth.api.signUpEmail({
      body: { email, name: "Home", password: PASSWORD },
    });

    const profile = await prisma.userLearningProfile.create({ data: { userId: created.user.id } });

    await guestAuth.api.signInEmail({
      body: { email, password: PASSWORD },
      headers: await guestWithSettings(),
    });

    await expect(
      prisma.userLearningProfile.findUniqueOrThrow({ where: { userId: created.user.id } }),
    ).resolves.toMatchObject({ id: profile.id, memoryEnabled: true, soundsEnabled: true });
  });
});
