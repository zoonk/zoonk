import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { headers } from "next/headers";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getSession } from "../users/get-session";
import { claimGenerationQuotaIfNeeded } from "./claim-generation-quota";
import {
  GENERATION_VISITOR_ID_HEADER,
  type GenerationQuotaPeriod,
  type GenerationQuotaResource,
  type GenerationQuotaViewer,
} from "./contract";

vi.mock("next/headers", () => ({ headers: vi.fn() }));
vi.mock("../users/get-session", () => ({ getSession: vi.fn() }));

/** Creates a valid documentation-range address so repeated test runs never reuse a request quota. */
function getUniqueNetworkAddress(): string {
  const addressId = randomUUID().replaceAll("-", "");

  return [
    "2001",
    "db8",
    addressId.slice(0, 4),
    addressId.slice(4, 8),
    addressId.slice(8, 12),
    addressId.slice(12, 16),
    addressId.slice(16, 20),
    addressId.slice(20, 24),
  ].join(":");
}

/** Gives one test a distinct durable browser identity without sharing quota state with another test. */
function useGuestViewer(): string {
  const visitorId = randomUUID();

  vi.mocked(headers).mockResolvedValue(
    new Headers({
      [GENERATION_VISITOR_ID_HEADER]: visitorId,
      "x-vercel-forwarded-for": getUniqueNetworkAddress(),
    }),
  );

  vi.mocked(getSession).mockResolvedValue(null);
  return visitorId;
}

/** Uses the real subscription query while replacing only the request session boundary. */
async function useAuthenticatedViewer({ subscriber }: { subscriber: boolean }) {
  const fixture = await userFixture();

  const user = await prisma.user.update({
    data: { username: `rate-limit-${randomUUID()}` },
    where: { id: fixture.id },
  });

  vi.mocked(getSession, { partial: true }).mockResolvedValue({ user });

  if (subscriber) {
    await prisma.subscription.create({
      data: { plan: "plus", provider: "zoonk", referenceId: user.id, status: "active" },
    });
  }

  return user;
}

/** Keeps quota assertions focused on the rejected resource and entitlement. */
function getReachedLimitResult({
  period,
  resource,
  viewer,
}: {
  period: GenerationQuotaPeriod;
  resource: GenerationQuotaResource;
  viewer: GenerationQuotaViewer;
}) {
  return { limit: { period, resource, viewer }, status: "limitReached" };
}

/** Moves the counter created by a real claim near a boundary without issuing hundreds of requests. */
async function setClaimCounter({
  count,
  period,
  resource,
  targetId,
}: {
  count: number;
  period: GenerationQuotaPeriod;
  resource: "chapter" | "course" | "lesson";
  targetId: string;
}) {
  const claim = await prisma.generationQuotaClaim.findUniqueOrThrow({
    where: { generationQuotaClaim: { resource, targetId } },
  });

  await prisma.generationQuotaCounter.updateMany({
    data: { count },
    where: { actorKey: claim.actorKey, period, resource },
  });
}

/** Exercises the production quota boundary while keeping each test call explicit about new AI work. */
function claimGenerationQuota({
  resource,
  targetId,
}: {
  resource: "chapter" | "course" | "lesson";
  targetId: string;
}) {
  return claimGenerationQuotaIfNeeded({ resource, shouldClaimQuota: true, targetId });
}

describe(claimGenerationQuotaIfNeeded, () => {
  beforeEach(() => {
    useGuestViewer();
  });

  it("does not charge a workflow resume that creates no new content", async () => {
    const targetId = randomUUID();

    await expect(
      claimGenerationQuotaIfNeeded({ resource: "course", shouldClaimQuota: false, targetId }),
    ).resolves.toStrictEqual({ status: "ready" });

    await expect(
      prisma.generationQuotaClaim.findUnique({
        where: { generationQuotaClaim: { resource: "course", targetId } },
      }),
    ).resolves.toBeNull();
  });

  it("limits guests to three course generations per day", async () => {
    const results = await Promise.all(
      Array.from({ length: 4 }, () =>
        claimGenerationQuota({ resource: "course", targetId: randomUUID() }),
      ),
    );

    expect(results.filter((result) => result.status === "ready")).toHaveLength(3);

    expect(results.filter((result) => result.status === "limitReached")).toMatchObject([
      getReachedLimitResult({ period: "day", resource: "course", viewer: "guest" }),
    ]);
  });

  it("limits guests to ten course generations per month", async () => {
    const firstTargetId = randomUUID();
    await claimGenerationQuota({ resource: "course", targetId: firstTargetId });

    await setClaimCounter({
      count: 9,
      period: "month",
      resource: "course",
      targetId: firstTargetId,
    });

    await expect(
      claimGenerationQuota({ resource: "course", targetId: randomUUID() }),
    ).resolves.toStrictEqual({ status: "ready" });

    await expect(
      claimGenerationQuota({ resource: "course", targetId: randomUUID() }),
    ).resolves.toMatchObject(
      getReachedLimitResult({ period: "month", resource: "course", viewer: "guest" }),
    );
  });

  it("limits authenticated learners to five courses per day", async () => {
    await useAuthenticatedViewer({ subscriber: false });
    const firstTargetId = randomUUID();
    await claimGenerationQuota({ resource: "course", targetId: firstTargetId });
    await setClaimCounter({ count: 4, period: "day", resource: "course", targetId: firstTargetId });

    await expect(
      claimGenerationQuota({ resource: "course", targetId: randomUUID() }),
    ).resolves.toStrictEqual({ status: "ready" });

    await expect(
      claimGenerationQuota({ resource: "course", targetId: randomUUID() }),
    ).resolves.toMatchObject(
      getReachedLimitResult({ period: "day", resource: "course", viewer: "authenticated" }),
    );
  });

  it("limits subscribers to twenty courses per day", async () => {
    await useAuthenticatedViewer({ subscriber: true });
    const firstTargetId = randomUUID();
    await claimGenerationQuota({ resource: "course", targetId: firstTargetId });

    await setClaimCounter({
      count: 19,
      period: "day",
      resource: "course",
      targetId: firstTargetId,
    });

    await expect(
      claimGenerationQuota({ resource: "course", targetId: randomUUID() }),
    ).resolves.toStrictEqual({ status: "ready" });

    await expect(
      claimGenerationQuota({ resource: "course", targetId: randomUUID() }),
    ).resolves.toMatchObject(
      getReachedLimitResult({ period: "day", resource: "course", viewer: "subscriber" }),
    );
  });

  it("limits chapter generation to fifty per day", async () => {
    await useAuthenticatedViewer({ subscriber: true });
    const firstTargetId = randomUUID();
    await claimGenerationQuota({ resource: "chapter", targetId: firstTargetId });

    await setClaimCounter({
      count: 49,
      period: "day",
      resource: "chapter",
      targetId: firstTargetId,
    });

    await expect(
      claimGenerationQuota({ resource: "chapter", targetId: randomUUID() }),
    ).resolves.toStrictEqual({ status: "ready" });

    await expect(
      claimGenerationQuota({ resource: "chapter", targetId: randomUUID() }),
    ).resolves.toMatchObject(
      getReachedLimitResult({ period: "day", resource: "chapter", viewer: "subscriber" }),
    );
  });

  it.each([
    { daily: 20, subscriber: false, viewer: "guest" as const },
    { daily: 50, subscriber: false, viewer: "authenticated" as const },
    { daily: 400, subscriber: true, viewer: "subscriber" as const },
  ])("applies the $viewer daily lesson limit", async ({ daily, subscriber, viewer }) => {
    if (viewer !== "guest") {
      await useAuthenticatedViewer({ subscriber });
    }

    const firstTargetId = randomUUID();
    await claimGenerationQuota({ resource: "lesson", targetId: firstTargetId });

    await setClaimCounter({
      count: daily - 1,
      period: "day",
      resource: "lesson",
      targetId: firstTargetId,
    });

    await expect(
      claimGenerationQuota({ resource: "lesson", targetId: randomUUID() }),
    ).resolves.toStrictEqual({ status: "ready" });

    await expect(
      claimGenerationQuota({ resource: "lesson", targetId: randomUUID() }),
    ).resolves.toMatchObject(getReachedLimitResult({ period: "day", resource: "lesson", viewer }));
  });

  it.each([
    {
      monthly: 10,
      resource: "course" as const,
      subscriber: false,
      viewer: "authenticated" as const,
    },
    { monthly: 60, resource: "course" as const, subscriber: true, viewer: "subscriber" as const },
    {
      monthly: 300,
      resource: "lesson" as const,
      subscriber: false,
      viewer: "authenticated" as const,
    },
    { monthly: 5000, resource: "lesson" as const, subscriber: true, viewer: "subscriber" as const },
  ])(
    "limits $viewer $resource generation to $monthly per month",
    async ({ monthly, resource, subscriber, viewer }) => {
      await useAuthenticatedViewer({ subscriber });
      const firstTargetId = randomUUID();
      await claimGenerationQuota({ resource, targetId: firstTargetId });

      await setClaimCounter({
        count: monthly - 1,
        period: "month",
        resource,
        targetId: firstTargetId,
      });

      await expect(
        claimGenerationQuota({ resource, targetId: randomUUID() }),
      ).resolves.toStrictEqual({ status: "ready" });

      await expect(
        claimGenerationQuota({ resource, targetId: randomUUID() }),
      ).resolves.toMatchObject(getReachedLimitResult({ period: "month", resource, viewer }));
    },
  );

  it("does not reset a guest quota when a private window creates a new visitor ID", async () => {
    const networkAddress = getUniqueNetworkAddress();

    vi.mocked(headers).mockResolvedValue(
      new Headers({
        [GENERATION_VISITOR_ID_HEADER]: randomUUID(),
        "x-vercel-forwarded-for": networkAddress,
      }),
    );

    const firstVisitorResults = await Promise.all(
      Array.from({ length: 3 }, () =>
        claimGenerationQuota({ resource: "course", targetId: randomUUID() }),
      ),
    );

    expect(firstVisitorResults.every((result) => result.status === "ready")).toBe(true);

    vi.mocked(headers).mockResolvedValue(
      new Headers({
        [GENERATION_VISITOR_ID_HEADER]: randomUUID(),
        "x-vercel-forwarded-for": networkAddress,
      }),
    );

    await expect(
      claimGenerationQuota({ resource: "course", targetId: randomUUID() }),
    ).resolves.toMatchObject(
      getReachedLimitResult({ period: "day", resource: "course", viewer: "guest" }),
    );
  });

  it("does not reset a guest quota when the same browser changes networks", async () => {
    const visitorId = randomUUID();
    const firstNetworkAddress = getUniqueNetworkAddress();
    const secondNetworkAddress = getUniqueNetworkAddress();

    vi.mocked(headers).mockResolvedValue(
      new Headers({
        [GENERATION_VISITOR_ID_HEADER]: visitorId,
        "x-vercel-forwarded-for": firstNetworkAddress,
      }),
    );

    const firstNetworkResults = await Promise.all(
      Array.from({ length: 3 }, () =>
        claimGenerationQuota({ resource: "course", targetId: randomUUID() }),
      ),
    );

    expect(firstNetworkResults.every((result) => result.status === "ready")).toBe(true);

    vi.mocked(headers).mockResolvedValue(
      new Headers({
        [GENERATION_VISITOR_ID_HEADER]: visitorId,
        "x-vercel-forwarded-for": secondNetworkAddress,
      }),
    );

    await expect(
      claimGenerationQuota({ resource: "course", targetId: randomUUID() }),
    ).resolves.toMatchObject(
      getReachedLimitResult({ period: "day", resource: "course", viewer: "guest" }),
    );
  });

  it("does not charge duplicate requests for the same target twice", async () => {
    const targetId = randomUUID();

    const [first, duplicate] = await Promise.all([
      claimGenerationQuota({ resource: "course", targetId }),
      claimGenerationQuota({ resource: "course", targetId }),
    ]);

    expect(first).toStrictEqual({ status: "ready" });
    expect(duplicate).toStrictEqual({ status: "ready" });

    const claim = await prisma.generationQuotaClaim.findUniqueOrThrow({
      where: { generationQuotaClaim: { resource: "course", targetId } },
    });

    await expect(
      prisma.generationQuotaCounter.findMany({ where: { actorKey: claim.actorKey, count: 1 } }),
    ).resolves.toHaveLength(2);
  });
});
