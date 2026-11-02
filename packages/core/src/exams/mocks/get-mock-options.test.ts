import { type TransactionClient, prisma } from "@zoonk/db";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it, vi } from "vitest";
import { mockSession } from "../../_test-utils/mock-session";
import { getMockOptions } from "./get-mock-options";
import { type MockResult } from "./mock-contract";

function observeLatestMockReads(observe: (client: TransactionClient) => () => void) {
  const restoreRoot = observe(prisma);
  const transaction = prisma.$transaction.bind(prisma);

  const transactions = vi.spyOn(prisma, "$transaction").mockImplementation((async (
    callback: Parameters<typeof prisma.$transaction>[0],
    options: Parameters<typeof prisma.$transaction>[1],
  ) =>
    transaction(async (client) => {
      /** Transaction proxies inherit root methods; installing both hooks would stack them. */
      restoreRoot();
      const restore = observe(client);

      try {
        return await callback(client);
      } finally {
        restore();
      }
    }, options)) as typeof prisma.$transaction);

  return () => {
    transactions.mockRestore();
    restoreRoot();
  };
}

const RESULT: MockResult = {
  areas: [],
  blank: 0,
  calibration: null,
  coherence: null,
  correct: 1,
  irt: null,
  minutesUsed: 10,
  net: null,
  plannedMinutes: 10,
  preparation: null,
  previous: null,
  scoring: "raw",
  topics: [],
  total: 2,
  unansweredAtTimeout: 0,
};

describe(getMockOptions, () => {
  it("keeps the latest mock's number when another mock completes between options reads", async () => {
    const user = await userFixture();
    const goal = await goalFixture({ kind: "exam", timezone: "UTC", userId: user.id });
    const firstDate = new Date("2026-01-01T00:00:00Z");
    const secondDate = new Date("2026-01-02T00:00:00Z");

    await prisma.mockExam.create({
      data: {
        conditions: {},
        createdAt: firstDate,
        finishedAt: firstDate,
        goalId: goal.id,
        result: RESULT,
        sectionStartedAt: firstDate,
        status: "finished",
        userId: user.id,
      },
    });

    const pending = await prisma.mockExam.create({
      data: {
        conditions: {},
        createdAt: secondDate,
        goalId: goal.id,
        sectionStartedAt: secondDate,
        status: "active",
        userId: user.id,
      },
    });

    mockSession(user.id);
    const completed = Promise.withResolvers<null>();

    const restore = observeLatestMockReads((client) => {
      const findFirst = client.mockExam.findFirst.bind(client.mockExam);
      const count = client.mockExam.count.bind(client.mockExam);

      const newest = vi.spyOn(client.mockExam, "findFirst").mockImplementation((async (
        args: Parameters<typeof findFirst>[0],
      ) => {
        const row = await findFirst(args);

        if (args?.where?.goalId === goal.id && args.where.status === "finished") {
          try {
            await prisma.mockExam.update({
              data: {
                finishedAt: secondDate,
                result: { ...RESULT, correct: 2 },
                status: "finished",
              },
              where: { id: pending.id },
            });
          } finally {
            completed.resolve(null);
          }
        }

        return row;
      }) as unknown as typeof findFirst);

      const numbering = vi.spyOn(client.mockExam, "count").mockImplementation((async (
        args: Parameters<typeof count>[0],
      ) => {
        await completed.promise;
        return count(args);
      }) as unknown as typeof count);

      return () => {
        newest.mockRestore();
        numbering.mockRestore();
      };
    });

    try {
      const response = await getMockOptions({ goalId: goal.id });
      expect(response.status).toBe("ready");

      expect(response.status === "ready" && response.view.lastMock).toMatchObject({
        correct: 1,
        finishedAt: firstDate.toISOString(),
        number: 1,
      });
    } finally {
      restore();
    }

    await expect(
      prisma.mockExam.count({ where: { goalId: goal.id, status: "finished" } }),
    ).resolves.toBe(2);

    const fresh = await getMockOptions({ goalId: goal.id });
    expect(fresh.status).toBe("ready");

    expect(fresh.status === "ready" && fresh.view.lastMock).toMatchObject({
      correct: 2,
      finishedAt: secondDate.toISOString(),
      number: 2,
    });
  });
});
