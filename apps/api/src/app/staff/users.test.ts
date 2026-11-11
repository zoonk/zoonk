import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { userFixture } from "@zoonk/testing/fixtures/users";
import * as logger from "@zoonk/utils/logger";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { signInStaff, staffRequest } from "./_test-utils/requests";
import { POST as countRecords } from "./records/count/route";
import { POST as findUser } from "./users/find/route";
import { POST as searchUsers } from "./users/search/route";

function find(query: string) {
  return findUser(staffRequest({ body: { query }, path: "/staff/users/find" }));
}

function search({ query, limit }: { query: string; limit?: number }) {
  return searchUsers(staffRequest({ body: { limit, query }, path: "/staff/users/search" }));
}

describe("staff user routes", () => {
  it("returns exact account facts and the effective plan for email, username and id", async () => {
    await signInStaff();
    const user = await userFixture();
    const username = `staff_${randomUUID()}`;

    await prisma.user.update({
      data: { banReason: "Fixture ban", banned: true, username },
      where: { id: user.id },
    });

    await prisma.subscription.create({
      data: {
        periodEnd: new Date("2020-01-01"),
        plan: "plus",
        provider: "apple",
        providerSubscriptionId: randomUUID(),
        referenceId: user.id,
        status: "active",
        userId: user.id,
      },
    });

    await Promise.all(
      [user.email.toUpperCase(), username.toUpperCase(), user.id].map(async (query) => {
        const response = await find(query);
        expect(response.status).toBe(200);

        await expect(response.json()).resolves.toMatchObject({
          user: {
            banReason: "Fixture ban",
            banned: true,
            effectivePlan: "free",
            email: user.email,
            id: user.id,
            isAnonymous: false,
            name: user.name,
            role: "user",
            username,
          },
        });
      }),
    );

    const missing = await find(user.email.slice(1));
    expect(missing.status).toBe(200);
    await expect(missing.json()).resolves.toStrictEqual({ user: null });

    await prisma.subscription.create({
      data: { plan: "plus", provider: "zoonk", referenceId: user.id, status: "active" },
    });

    const subscribed = await find(user.id);
    await expect(subscribed.json()).resolves.toMatchObject({ user: { effectivePlan: "plus" } });
  });

  it("shares Admin's substring rule and preserves limits and whitespace", async () => {
    await signInStaff();
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

    const response = await search({ query: marker.toUpperCase() });
    expect(response.status).toBe(200);

    const body = z
      .object({ users: z.array(z.object({ id: z.string() })) })
      .parse(await response.json());

    expect(body.users.map((user) => user.id).toSorted()).toStrictEqual(
      [nameMatch.id, emailMatch.id, usernameMatch.id].toSorted(),
    );

    const spaced = await search({ query: ` ${marker} ` });

    await expect(spaced.json()).resolves.toMatchObject({
      users: [expect.objectContaining({ id: nameMatch.id })],
    });

    const limited = await search({ limit: 1, query: marker });
    await expect(limited.json()).resolves.toMatchObject({ users: [expect.any(Object)] });
    const oversized = await search({ limit: 101, query: marker });
    expect(oversized.status).toBe(400);
  });

  it("logs one line per call without tokens, filter values, email input or search text", async () => {
    const { accessToken, user } = await signInStaff();
    const log = vi.spyOn(logger, "logInfo");

    const responses = await Promise.all([
      find(user.email),
      search({ query: user.email }),
      countRecords(
        staffRequest({
          body: { model: "User", where: [{ field: "email", op: "eq", value: user.email }] },
          path: "/staff/records/count",
        }),
      ),
    ]);

    expect(responses.map((response) => response.status)).toStrictEqual([200, 200, 200]);
    expect(log).toHaveBeenCalledTimes(3);

    expect(log.mock.calls.every((args) => args.length === 1 && typeof args[0] === "string")).toBe(
      true,
    );

    expect(log.mock.calls.every(([line]) => !String(line).includes("\n"))).toBe(true);
    const entries = log.mock.calls.map(([line]): unknown => JSON.parse(String(line)));

    expect(entries).toStrictEqual(
      expect.arrayContaining([
        expect.objectContaining({
          actorUserId: user.id,
          clientId: "zoonk-cli",
          event: "staff.read",
          filters: [{ field: "email", op: "eq" }],
          model: "User",
          outcome: "ready",
          rowCount: 1,
          verb: "count",
        }),
      ]),
    );

    const text = JSON.stringify(log.mock.calls);
    expect(text).not.toContain(user.email);
    expect(text).not.toContain(accessToken);
  });
});
