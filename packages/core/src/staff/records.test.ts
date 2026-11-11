import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { safeAsync } from "@zoonk/utils/error";
import { logInfo } from "@zoonk/utils/logger";
import { notFound } from "next/navigation";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getStaffModels } from "./models";
import { staffRead, staffTransaction } from "./read";
import { countStaffRecords, getStaffRecord, listStaffRecords } from "./records";
import { findStaffUser, searchStaffUsers } from "./users";

const { actor } = vi.hoisted(() => ({
  actor:
    vi.fn<
      () => Promise<
        | { status: "ready"; userId: string; clientId: string }
        | { status: "unauthorized" | "forbidden"; userId?: string; clientId?: string }
      >
    >(),
}));

// The API route suite verifies real CLI tokens; these tests isolate the data boundary.
vi.mock("./get-staff-actor", () => ({ getStaffActor: actor }));

function ready<T extends { status: string }>(result: T): Extract<T, { status: "ready" }> {
  expect(result.status).toBe("ready");

  if (result.status !== "ready") {
    throw new Error(JSON.stringify(result));
  }

  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- The discriminant was checked above.
  return result as Extract<T, { status: "ready" }>;
}

describe("staff reads", () => {
  beforeEach(() => {
    actor.mockResolvedValue({ clientId: "zoonk-cli", status: "ready", userId: "staff-fixture" });
  });

  it("propagates Next.js control flow before recording a result", async () => {
    const { error } = await safeAsync(async () => notFound());
    actor.mockRejectedValueOnce(error);
    await expect(getStaffModels()).rejects.toBe(error);
    expect(logInfo).not.toHaveBeenCalled();
  });

  it("attributes forbidden calls when the principal supplies its identity", async () => {
    actor.mockResolvedValueOnce({
      clientId: "zoonk-cli",
      status: "forbidden",
      userId: "staff-fixture",
    });

    await expect(getStaffModels()).resolves.toStrictEqual({ status: "forbidden" });
    const [line] = vi.mocked(logInfo).mock.calls[0] ?? [];
    const entry: unknown = JSON.parse(String(line));

    expect(entry).toMatchObject({
      actorUserId: "staff-fixture",
      clientId: "zoonk-cli",
      outcome: "forbidden",
    });
  });

  it.each(["unauthorized", "forbidden"] as const)(
    "checks the actor before validating or reading for %s",
    async (status) => {
      actor.mockResolvedValue({ status });

      const outcomes = await Promise.all([
        getStaffModels(),
        getStaffRecord({ model: "Verification" }),
        listStaffRecords({ model: "User" }),
        countStaffRecords({ model: "User" }),
        findStaffUser({ query: "private@example.test" }),
        searchStaffUsers({ query: "private" }),
      ]);

      expect(outcomes).toStrictEqual(Array.from({ length: 6 }, () => ({ status })));
    },
  );

  it("reads account facts without selecting credentials", async () => {
    const user = await userFixture();
    const account = await prisma.account.findFirstOrThrow({ where: { userId: user.id } });

    await prisma.account.update({
      data: {
        accessToken: "private-access",
        idToken: "private-id",
        refreshToken: "private-refresh",
      },
      where: { id: account.id },
    });

    const result = ready(await getStaffRecord({ id: account.id, model: "Account" }));
    expect(result.record).toMatchObject({ accountId: user.id, userId: user.id });

    for (const field of ["password", "accessToken", "refreshToken", "idToken", "user"]) {
      expect(result.record).not.toHaveProperty(field);
    }

    const session = await prisma.session.create({
      data: { expiresAt: new Date("2030-01-01"), token: randomUUID(), userId: user.id },
    });

    expect(
      ready(await getStaffRecord({ id: session.id, model: "Session" })).record,
    ).not.toHaveProperty("token");

    await expect(getStaffRecord({ id: randomUUID(), model: "User" })).resolves.toStrictEqual({
      message: "No User with that id.",
      status: "notFound",
    });

    await expect(
      getStaffRecord({ id: "irrelevant", model: "CourseChapter" }),
    ).resolves.toMatchObject({ message: expect.stringContaining("Use list"), status: "invalid" });
  });

  it("rejects excluded models, credential filters, relations, bad operations and forged Prisma arguments", async () => {
    await expect(listStaffRecords({ model: "Verification" })).resolves.toMatchObject({
      message: expect.stringContaining("Valid models:"),
      status: "invalid",
    });

    const unreadableMessages = await Promise.all(
      ["token", "user", "notAField"].map(async (field) => {
        const result = await listStaffRecords({
          model: "Session",
          where: [{ field, op: "eq", value: "secret" }],
        });

        expect(result).toMatchObject({
          message: expect.stringContaining(`Field "${field}" is not readable. Valid fields:`),
          status: "invalid",
        });

        expect(JSON.stringify(result)).not.toContain("secret");

        return result.status === "invalid"
          ? result.message.replace(`"${field}"`, '"requestedField"')
          : undefined;
      }),
    );

    expect(new Set(unreadableMessages).size).toBe(1);

    await expect(
      countStaffRecords({
        model: "User",
        where: [{ field: "name", op: "contains", value: "text" }],
      }),
    ).resolves.toMatchObject({ message: expect.stringContaining("eq"), status: "invalid" });

    await expect(
      listStaffRecords({ include: { accounts: true }, model: "User" }),
    ).resolves.toMatchObject({ status: "invalid" });

    await expect(
      listStaffRecords({ model: "User", orderBy: { direction: "asc", field: "password" } }),
    ).resolves.toMatchObject({ status: "invalid" });

    await expect(
      countStaffRecords({
        model: "User",
        where: [{ field: "id", op: "eq", value: { not: null } }],
      }),
    ).resolves.toMatchObject({ status: "invalid" });
  });

  it("caps returned rows, computes hasMore and keeps offset pagination stable", async () => {
    const name = `staff-cap-${randomUUID()}`;

    await prisma.user.createMany({
      data: Array.from({ length: 101 }, () => ({ email: `${randomUUID()}@example.test`, name })),
    });

    const where = [{ field: "name", op: "eq", value: name }];
    const first = ready(await listStaffRecords({ limit: 100, model: "User", where }));
    expect(first.records).toHaveLength(100);
    expect(first.hasMore).toBe(true);

    expect(
      ready(await listStaffRecords({ limit: 100, model: "User", offset: 100, where })),
    ).toMatchObject({ hasMore: false, records: [expect.objectContaining({ name })] });

    expect(ready(await countStaffRecords({ model: "User", where })).count).toBe(101);
    expect(ready(await listStaffRecords({ model: "User", where })).records).toHaveLength(20);

    await expect(listStaffRecords({ limit: 101, model: "User" })).resolves.toMatchObject({
      status: "invalid",
    });
  });

  it("applies typed conjunctions, null tests, membership and ordered comparisons", async () => {
    const name = `staff-filter-${randomUUID()}`;
    const users = await Promise.all([userFixture({ name }), userFixture({ name })]);

    await prisma.user.update({
      data: { username: `staff_${randomUUID()}` },
      where: { id: users[1]!.id },
    });

    const where = [{ field: "id", op: "in", value: users.map((user) => user.id) }];

    expect(
      ready(
        await countStaffRecords({
          model: "User",
          where: [...where, { field: "username", op: "isNull" }],
        }),
      ).count,
    ).toBe(1);

    expect(
      ready(
        await countStaffRecords({
          model: "User",
          where: [...where, { field: "username", op: "notNull" }],
        }),
      ).count,
    ).toBe(1);

    expect(
      ready(
        await countStaffRecords({
          model: "User",
          where: [...where, { field: "id", op: "notIn", value: [users[0]!.id] }],
        }),
      ).count,
    ).toBe(1);

    expect(
      ready(
        await countStaffRecords({
          model: "User",
          where: [...where, { field: "createdAt", op: "gte", value: "2020-01-01T00:00:00Z" }],
        }),
      ).count,
    ).toBe(2);

    expect(
      ready(
        await countStaffRecords({
          model: "User",
          where: [...where, { field: "name", op: "ne", value: "other" }],
        }),
      ).count,
    ).toBe(2);
  });

  it("serializes BigInt from the database", async () => {
    const rate = await prisma.rateLimit.create({
      data: { count: 1, key: randomUUID(), lastRequest: 9_007_199_254_740_993n },
    });

    expect(ready(await getStaffRecord({ id: rate.id, model: "RateLimit" })).record).toMatchObject({
      lastRequest: "9007199254740993",
    });
  });

  it("logs one line per call without filter values, search text, or credentials", async () => {
    const user = await userFixture({ name: "Private search text" });
    const log = vi.mocked(logInfo);

    await countStaffRecords({
      model: "User",
      where: [{ field: "email", op: "eq", value: user.email }],
    });

    expect(log).toHaveBeenCalledOnce();

    expect(log).toHaveBeenLastCalledWith(expect.any(String));
    const [line] = log.mock.calls[0] ?? [];
    expect(line).not.toContain("\n");
    const entry: unknown = JSON.parse(String(line));

    expect(entry).toMatchObject({
      actorUserId: "staff-fixture",
      event: "staff.read",
      filters: [{ field: "email", op: "eq" }],
      outcome: "ready",
      rowCount: 1,
    });

    await findStaffUser({ query: user.email });
    await searchStaffUsers({ query: user.name });
    expect(log).toHaveBeenCalledTimes(3);
    expect(JSON.stringify(log.mock.calls)).not.toContain(user.email);
    expect(JSON.stringify(log.mock.calls)).not.toContain(user.name);
  });

  it("sets the default statement timeout to five seconds inside the transaction", async () => {
    const [setting] = await staffTransaction(
      (client) => client.$queryRaw<[{ statement_timeout: string }]>`SHOW statement_timeout`,
    );

    expect(setting.statement_timeout).toBe("5s");
  });

  it("maps real Postgres query cancellation to a timeout result", async () => {
    const result = await staffRead({
      call: { verb: "timeout-probe" },
      run: async () => {
        await staffTransaction(async (client) => {
          await client.$executeRaw`SET LOCAL statement_timeout = '50ms'`;
          await client.$queryRaw`SELECT pg_sleep(1)`;
        });

        return { data: {}, rows: 0 };
      },
    });

    expect(result).toMatchObject({
      message: expect.stringContaining("narrower filters"),
      status: "timeout",
    });
  });
});
