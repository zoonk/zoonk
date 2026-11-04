import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { getString } from "@zoonk/utils/json";
import { betterAuth } from "better-auth/minimal";
import { describe, expect, it, vi } from "vitest";
import { captureAccountDeletionCleanup } from "../account-deletion";
import { BETTER_AUTH_BASE_PATH } from "../config";
import {
  createTestEmail,
  guestAuth,
  signInAsGuest,
  signUp as signUpLearner,
} from "../guests/_test-utils/guest-auth";
import { baseAuthConfig, baseAuthPlugins } from "../server";
import { accessGuardsPlugin } from "./access-guards";

const stripeMocks = vi.hoisted(() => ({ create: vi.fn(), search: vi.fn() }));

vi.mock("../stripe/client", () => ({
  stripeClient: {
    checkout: { sessions: { create: stripeMocks.create } },
    customers: { create: stripeMocks.create, search: stripeMocks.search },
    prices: { list: stripeMocks.search },
  },
}));

vi.mock("@vercel/blob", () => ({
  del: vi.fn(),
  list: vi.fn().mockResolvedValue({ blobs: [], hasMore: false }),
}));

const UPGRADE_BODY = { cancelUrl: "/", plan: "plus", successUrl: "/" };

const organizationAuth = betterAuth({
  ...baseAuthConfig,
  baseURL: "http://localhost:3000",
  emailAndPassword: {
    enabled: true,
    password: {
      hash: async (password) => password,
      verify: async ({ hash, password }) => hash === password,
    },
  },
  plugins: [...baseAuthPlugins, accessGuardsPlugin()],
  rateLimit: { enabled: false },
  secret: "access-guards-test-secret-with-enough-entropy",
});

async function signInAsBrandOwner() {
  const [organization, signUp] = await Promise.all([
    prisma.organization.create({
      data: { kind: "brand", name: "Brand", slug: `brand-${randomUUID()}` },
    }),
    organizationAuth.api.signUpEmail({
      body: {
        email: `brand-owner-${randomUUID()}@example.test`,
        name: "Owner",
        password: "pass1234",
      },
      returnHeaders: true,
    }),
  ]);

  await prisma.member.create({
    data: { organizationId: organization.id, role: "owner", userId: signUp.response.user.id },
  });

  const cookie = signUp.headers
    .getSetCookie()
    .map((setCookie) => setCookie.split(";")[0])
    .join("; ");

  return { headers: new Headers({ cookie }), organization };
}

const BRAND_ADDRESS_LOCKED = { body: { code: "BRAND_ADDRESS_LOCKED" }, statusCode: 403 };

async function signUpProfileLearner() {
  const signUp = await organizationAuth.api.signUpEmail({
    body: { email: `profile-${randomUUID()}@example.test`, name: "Ana", password: "pass1234" },
    returnHeaders: true,
  });

  const cookie = signUp.headers
    .getSetCookie()
    .map((setCookie) => setCookie.split(";")[0])
    .join("; ");

  return { headers: new Headers({ cookie }), userId: signUp.response.user.id };
}

const INVALID_PROFILE_UPDATE = { code: "INVALID_PROFILE_UPDATE", status: 400 };

async function updateUser({
  auth = organizationAuth,
  body,
  headers,
}: {
  auth?: typeof organizationAuth | typeof guestAuth;
  body: unknown;
  headers: Headers;
}) {
  const requestHeaders = new Headers(headers);
  requestHeaders.set("content-type", "application/json");
  requestHeaders.set("origin", "http://localhost:3000");

  const response = await auth.handler(
    new Request(`http://localhost:3000${BETTER_AUTH_BASE_PATH}/update-user`, {
      body: JSON.stringify(body),
      headers: requestHeaders,
      method: "POST",
    }),
  );

  const text = await response.text();
  const answer: unknown = text ? JSON.parse(text) : null;

  return { code: getString(answer, "code"), status: response.status };
}

describe("access guards", () => {
  it("asks guests to create an account before checkout", async () => {
    const { headers } = await signInAsGuest();

    await expect(
      guestAuth.api.upgradeSubscription({ body: UPGRADE_BODY, headers }),
    ).rejects.toMatchObject({ body: { code: "GUEST_PURCHASE_NOT_ALLOWED" }, statusCode: 403 });

    expect(stripeMocks.create).not.toHaveBeenCalled();
  });

  it("refuses a checkout while the learner has Plus, naming where it's managed", async () => {
    const { headers, userId } = await signUpLearner({ email: createTestEmail() });
    const dayFromNow = new Date(Date.now() + 86_400_000);

    await prisma.subscription.create({
      data: {
        periodEnd: dayFromNow,
        plan: "plus",
        provider: "apple",
        providerSubscriptionId: randomUUID(),
        referenceId: userId,
        status: "active",
        userId,
      },
    });

    await expect(
      guestAuth.api.upgradeSubscription({ body: UPGRADE_BODY, headers }),
    ).rejects.toMatchObject({
      body: { code: "PLUS_ALREADY_ACTIVE", provider: "apple" },
      statusCode: 409,
    });

    expect(stripeMocks.create).not.toHaveBeenCalled();
  });

  it("keeps a brand's address: its slug and kind don't change and it isn't deleted", async () => {
    const { headers, organization } = await signInAsBrandOwner();
    const organizationId = organization.id;
    const slug = `moved-${randomUUID()}`;

    for (const body of [
      { data: { slug }, organizationId },
      { data: { kind: "school" }, organizationId },
      { data: { name: "Moved", slug }, organizationId: "" },
      { data: { kind: "school" } },
      { data: { slug: organization.slug } },
    ]) {
      // oxlint-disable-next-line eslint/no-await-in-loop -- Each refusal is checked on its own.
      await expect(
        organizationAuth.api.updateOrganization({ body, headers }),
      ).rejects.toMatchObject(BRAND_ADDRESS_LOCKED);
    }

    await expect(
      organizationAuth.api.deleteOrganization({ body: { organizationId }, headers }),
    ).rejects.toMatchObject(BRAND_ADDRESS_LOCKED);

    await expect(
      prisma.organization.findUniqueOrThrow({ where: { id: organizationId } }),
    ).resolves.toMatchObject({ kind: "brand", name: organization.name, slug: organization.slug });
  });

  it("still renames a brand's name and logo", async () => {
    const { headers, organization } = await signInAsBrandOwner();

    await organizationAuth.api.updateOrganization({
      body: {
        data: { logo: "https://example.test/logo.png", name: "Renamed brand" },
        organizationId: organization.id,
      },
      headers,
    });

    await expect(
      prisma.organization.findUniqueOrThrow({ where: { id: organization.id } }),
    ).resolves.toMatchObject({
      kind: "brand",
      logo: "https://example.test/logo.png",
      name: "Renamed brand",
      slug: organization.slug,
    });
  });

  it("changes a learner's name and username only to text", async () => {
    const { headers, userId } = await signUpProfileLearner();

    const refusals = await Promise.all(
      [{ username: { set: "admin" } }, { name: { set: "a".repeat(5000) } }].map((body) =>
        updateUser({ body, headers }),
      ),
    );

    expect(refusals).toStrictEqual([INVALID_PROFILE_UPDATE, INVALID_PROFILE_UPDATE]);

    await expect(prisma.user.findUniqueOrThrow({ where: { id: userId } })).resolves.toMatchObject({
      name: "Ana",
      username: null,
    });
  });

  it("changes no other account field", async () => {
    const [learner, stripeLearner] = await Promise.all([
      signUpProfileLearner(),
      signUpLearner({ email: createTestEmail() }),
    ]);

    const refusals = await Promise.all([
      updateUser({ body: { image: "https://example.test/a.png" }, headers: learner.headers }),
      updateUser({
        auth: guestAuth,
        body: { stripeCustomerId: "cus_someone_else" },
        headers: stripeLearner.headers,
      }),
    ]);

    expect(refusals).toStrictEqual([INVALID_PROFILE_UPDATE, INVALID_PROFILE_UPDATE]);

    await expect(
      prisma.user.findMany({
        select: { image: true, stripeCustomerId: true },
        where: { id: { in: [learner.userId, stripeLearner.userId] } },
      }),
    ).resolves.toStrictEqual([
      { image: null, stripeCustomerId: null },
      { image: null, stripeCustomerId: null },
    ]);
  });

  it("still changes a learner's name and username", async () => {
    const { headers, userId } = await signUpProfileLearner();
    const username = `ana_${randomUUID().slice(0, 8)}`;

    await expect(
      updateUser({ body: { name: "Ana Lima", username: username.toUpperCase() }, headers }),
    ).resolves.toMatchObject({ status: 200 });

    await expect(prisma.user.findUniqueOrThrow({ where: { id: userId } })).resolves.toMatchObject({
      name: "Ana Lima",
      username,
    });
  });

  it("requires the deletion channel that reports provider cleanup", async () => {
    const { headers } = await signInAsBrandOwner();
    const session = await organizationAuth.api.getSession({ headers });

    await expect(organizationAuth.api.deleteUser({ body: {}, headers })).rejects.toMatchObject({
      body: { code: "ACCOUNT_DELETION_ELSEWHERE" },
      statusCode: 403,
    });

    await captureAccountDeletionCleanup({
      operation: () => organizationAuth.api.deleteUser({ body: {}, headers }),
    });

    await expect(prisma.user.findUnique({ where: { id: session?.user.id } })).resolves.toBeNull();
  });
});
