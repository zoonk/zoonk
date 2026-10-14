import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { betterAuth } from "better-auth/minimal";
import { describe, expect, it, vi } from "vitest";
import { guestAuth, signInAsGuest } from "../guests/_test-utils/guest-auth";
import { baseAuthConfig, baseAuthPlugins } from "../server";
import { accessGuardsPlugin } from "./access-guards";

/** Checkout must be blocked before any request reaches Stripe. */
const stripeMocks = vi.hoisted(() => ({ create: vi.fn(), search: vi.fn() }));

vi.mock("../stripe/client", () => ({
  stripeClient: {
    checkout: { sessions: { create: stripeMocks.create } },
    customers: { create: stripeMocks.create, search: stripeMocks.search },
    prices: { list: stripeMocks.search },
  },
}));

const UPGRADE_BODY = { cancelUrl: "/", plan: "plus", successUrl: "/" };

/** A real Better Auth instance with the production organization plugin and access guards. */
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

/** A brand and its owner, signed in, with the browser headers that carry the owner's session. */
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

describe("access guards", () => {
  it("asks guests to create an account before checkout", async () => {
    const { headers } = await signInAsGuest();

    await expect(
      guestAuth.api.upgradeSubscription({ body: UPGRADE_BODY, headers }),
    ).rejects.toMatchObject({ body: { code: "GUEST_PURCHASE_NOT_ALLOWED" }, statusCode: 403 });

    expect(stripeMocks.create).not.toHaveBeenCalled();
  });

  // A brand's slug and kind are in every one of its courses' public addresses. The refusal
  // doesn't depend on which organization the update targets or how its session arrives.
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
});
