import { prisma } from "@zoonk/db";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { countDatabaseStatements } from "@zoonk/testing/statement-counter";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../../_test-utils/mock-session";
import {
  findActiveSubscription,
  findActiveSubscriptionForUser,
  getActiveSubscription,
  hasActiveSubscription,
} from "../../auth/subscription";
import * as requestClock from "./request-instant";
import { readActiveSubscription } from "./subscription";

describe("display subscription request fact", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("returns the complete row only for its derived actor and keeps visitors without a query", async () => {
    const [owner, other] = await Promise.all([userFixture(), userFixture()]);

    const subscription = await prisma.subscription.create({
      data: { plan: "plus", provider: "zoonk", referenceId: owner.id, status: "trialing" },
    });

    const fact = await countDatabaseStatements(() => readActiveSubscription(owner.id));

    expect(fact).toMatchObject({ result: subscription, statements: 1, writes: 0 });
    await expect(readActiveSubscription(other.id)).resolves.toBeNull();
    mockSession(owner.id);
    await expect(getActiveSubscription()).resolves.toStrictEqual(subscription);
    mockSession(other.id);
    await expect(getActiveSubscription()).resolves.toBeNull();
    mockSession(null);

    const visitor = await countDatabaseStatements(getActiveSubscription);

    expect(visitor).toStrictEqual({ result: null, statements: 0, writes: 0 });
  });

  it("displays the request instant but rechecks Apple expiry at a fresh write instant", async () => {
    const user = await userFixture();

    const subscription = await prisma.subscription.create({
      data: {
        periodEnd: new Date("2026-07-12T12:01:00Z"),
        plan: "plus",
        provider: "apple",
        providerSubscriptionId: `request-fact-${user.id}`,
        referenceId: user.id,
        status: "active",
        userId: user.id,
      },
    });

    mockSession(user.id);
    vi.spyOn(requestClock, "getRequestInstant").mockResolvedValue(new Date("2026-07-12T12:00:00Z"));

    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-07-12T12:02:00Z"));

    await expect(readActiveSubscription(user.id)).resolves.toStrictEqual(subscription);
    await expect(getActiveSubscription()).resolves.toStrictEqual(subscription);
    await expect(hasActiveSubscription()).resolves.toBe(false);
    await expect(findActiveSubscription(user.id)).resolves.toBeNull();

    await expect(
      prisma.$transaction((client) =>
        findActiveSubscriptionForUser({ client, now: new Date(), userId: user.id }),
      ),
    ).resolves.toBeNull();
  });

  it("does not use a previous display result to authorize a canceled subscription", async () => {
    const user = await userFixture();

    const subscription = await prisma.subscription.create({
      data: { plan: "plus", provider: "zoonk", referenceId: user.id, status: "active" },
    });

    mockSession(user.id);
    await expect(getActiveSubscription()).resolves.toStrictEqual(subscription);

    await prisma.subscription.update({
      data: { status: "canceled" },
      where: { id: subscription.id },
    });

    await expect(findActiveSubscription(user.id)).resolves.toBeNull();
    await expect(hasActiveSubscription()).resolves.toBe(false);
  });
});
