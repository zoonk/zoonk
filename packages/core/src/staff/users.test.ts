import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it, vi } from "vitest";
import { findStaffUser, searchStaffUsers } from "./users";

// Auth's provider boundary has not landed; the capability's queries use the real database.
vi.mock("./get-staff-actor", () => ({
  getStaffActor: async () => ({ clientId: "zoonk-cli", status: "ready", userId: "staff-fixture" }),
}));

describe("staff user lookup", () => {
  it("finds exact email, username or id and includes account and effective-plan facts", async () => {
    const user = await userFixture();
    const username = `staff_${randomUUID()}`;

    await prisma.user.update({
      data: { banReason: "Fixture ban", banned: true, username },
      where: { id: user.id },
    });

    await prisma.subscription.create({
      data: { plan: "plus", provider: "zoonk", referenceId: user.id, status: "active" },
    });

    await Promise.all(
      [user.email.toUpperCase(), username.toUpperCase(), user.id].map(async (query) => {
        await expect(findStaffUser({ query })).resolves.toMatchObject({
          status: "ready",
          user: {
            banReason: "Fixture ban",
            banned: true,
            effectivePlan: "plus",
            email: user.email,
            id: user.id,
            isAnonymous: false,
            role: "user",
            username,
          },
        });
      }),
    );

    await expect(findStaffUser({ query: user.email.slice(1) })).resolves.toStrictEqual({
      status: "ready",
      user: null,
    });
  });

  it("uses the canonical native entitlement expiry rule instead of trusting active status", async () => {
    const [expired, current] = await Promise.all([userFixture(), userFixture()]);

    await prisma.subscription.createMany({
      data: [
        {
          periodEnd: new Date("2020-01-01"),
          plan: "plus",
          provider: "apple",
          providerSubscriptionId: randomUUID(),
          referenceId: expired.id,
          status: "active",
          userId: expired.id,
        },
        {
          cancelAtPeriodEnd: true,
          periodEnd: new Date("2030-01-01"),
          plan: "plus",
          provider: "google",
          providerSubscriptionId: randomUUID(),
          referenceId: current.id,
          status: "active",
          userId: current.id,
        },
      ],
    });

    await expect(findStaffUser({ query: expired.id })).resolves.toMatchObject({
      status: "ready",
      user: { effectivePlan: "free" },
    });

    await expect(findStaffUser({ query: current.id })).resolves.toMatchObject({
      status: "ready",
      user: { effectivePlan: "plus" },
    });
  });

  it("shares Admin's case-insensitive substring rule across name, email and username", async () => {
    const marker = randomUUID().slice(0, 8);

    const [nameMatch, emailMatch, usernameMatch] = await Promise.all([
      userFixture({ name: `Before ${marker} after` }),
      userFixture({ email: `before${marker}after@example.test` }),
      userFixture(),
    ]);

    await prisma.user.update({
      data: { username: `before${marker}after` },
      where: { id: usernameMatch.id },
    });

    const result = await searchStaffUsers({ query: marker.toUpperCase() });
    expect(result.status).toBe("ready");

    if (result.status !== "ready") {
      throw new Error("Search failed");
    }

    expect(result.users.map((user) => user.id).toSorted()).toStrictEqual(
      [nameMatch.id, emailMatch.id, usernameMatch.id].toSorted(),
    );

    await expect(searchStaffUsers({ query: ` ${marker} ` })).resolves.toMatchObject({
      status: "ready",
      users: [expect.objectContaining({ id: nameMatch.id })],
    });

    await expect(searchStaffUsers({ limit: 1, query: marker })).resolves.toMatchObject({
      status: "ready",
      users: [expect.any(Object)],
    });

    await expect(searchStaffUsers({ limit: 101, query: marker })).resolves.toMatchObject({
      status: "invalid",
    });
  });

  it("repeats concurrent reads without changing the account", async () => {
    const user = await userFixture();
    const before = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });

    const results = await Promise.all(
      Array.from({ length: 3 }, () => findStaffUser({ query: user.id })),
    );

    expect(results).toStrictEqual([results[0], results[0], results[0]]);

    await expect(prisma.user.findUniqueOrThrow({ where: { id: user.id } })).resolves.toStrictEqual(
      before,
    );
  });
});
