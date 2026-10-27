import { prisma } from "@zoonk/db";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { countDatabaseStatements } from "@zoonk/testing/statement-counter";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../../_test-utils/mock-session";
import { getAnytimeMockAccess } from "../../exams/mocks/_utils/anytime-mock-access";
import { findRunningAnytimeMock } from "../../exams/mocks/_utils/anytime-mock-setup";
import { getMockOptions } from "../../exams/mocks/get-mock-options";
import { mockConditionsSchema } from "../../exams/mocks/mock-contract";
import { loadTodayLearnBlocks } from "../../view-models/_utils/today-lesson-order";
import { getCurrentUserReviewSchedule } from "../get-current-user-review-schedule";
import * as requestClock from "./request-instant";
import type * as ProgressDateContext from "../../progress/get-request-date-context";

const INSTANT = new Date("2026-07-12T12:00:00Z");

async function runningMockFixture() {
  const user = await userFixture();
  const goal = await goalFixture({ kind: "exam", timezone: "UTC", userId: user.id });

  const conditions = mockConditionsSchema.parse({
    day: null,
    fullLength: true,
    purpose: "practice",
    scoring: "raw",
    sections: [
      { itemIds: ["first", "second"], minutes: 30, name: null, questions: 2, routing: null },
    ],
    shape: { area: null, day: null, kind: "full" },
    startTime: null,
    timeZone: "UTC",
  });

  const mock = await prisma.mockExam.create({
    data: {
      conditions,
      goalId: goal.id,
      sectionStartedAt: INSTANT,
      startedAt: INSTANT,
      status: "active",
      userId: user.id,
    },
  });

  return { goal, mock, user };
}

describe("GET request instant", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it.each([
    { access: "open", kind: "exam", tier: "plus" },
    { access: "plusRequired", kind: "exam", tier: "free" },
    { access: "open", kind: "learn", tier: "free" },
    { access: "open", kind: "exam", tier: "visitor" },
  ] as const)("keeps $kind mock access for $tier at $access", async ({ access, kind, tier }) => {
    const user = await userFixture();
    const goal = await goalFixture({ kind, userId: user.id });

    if (tier === "plus") {
      await prisma.subscription.create({
        data: { plan: "plus", provider: "zoonk", referenceId: user.id, status: "active" },
      });
    }

    mockSession(tier === "visitor" ? null : user.id);

    const reads = await countDatabaseStatements(() => getAnytimeMockAccess(goal));

    expect(reads.result).toBe(access);
    expect(reads.writes).toBe(0);
  });

  it("shows the running mock at the GET instant while a fresh writer sees it expired", async () => {
    const { goal, mock, user } = await runningMockFixture();
    mockSession(user.id);
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2030-01-01T12:00:00Z"));
    vi.spyOn(requestClock, "getRequestInstant").mockResolvedValue(INSTANT);

    const reads = await countDatabaseStatements(() => getMockOptions({ goalId: goal.id }));

    expect(reads.writes).toBe(0);

    expect(reads.result).toMatchObject({
      status: "ready",
      view: { running: { id: mock.id, purpose: "practice", shape: { kind: "full" } } },
    });

    await expect(
      prisma.$transaction((client) =>
        findRunningAnytimeMock({ client, goalId: goal.id, userId: user.id }),
      ),
    ).resolves.toBeNull();
  });

  it.each(["omitted", "undefined"] as const)(
    "reads a fresh %s writer clock after its transactional SQL completes",
    async (mode) => {
      const { goal, user } = await runningMockFixture();
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(INSTANT);
      const ready = Promise.withResolvers<number>();
      const release = Promise.withResolvers<null>();

      const holding = prisma.$transaction(
        async (client) => {
          await client.$executeRaw`SET LOCAL lock_timeout = '1s'`;
          await client.$executeRaw`LOCK TABLE mock_exams IN ACCESS EXCLUSIVE MODE`;

          const [connection] = await client.$queryRaw<
            { pid: number }[]
          >`SELECT pg_backend_pid() AS pid`;

          ready.resolve(connection?.pid ?? 0);
          await release.promise;
        },
        { timeout: 12_000 },
      );

      const held = Promise.allSettled([holding]);
      void holding.catch(ready.reject);

      try {
        const holderPid = await ready.promise;

        const reading = Promise.allSettled([
          prisma.$transaction(
            async (client) => {
              await client.$executeRaw`SET LOCAL lock_timeout = '5s'`;

              return findRunningAnytimeMock({
                client,
                goalId: goal.id,
                ...(mode === "undefined" ? { now: undefined } : {}),
                userId: user.id,
              });
            },
            { timeout: 8000 },
          ),
        ]);

        try {
          await expect
            .poll(
              async () => prisma.$queryRaw<{ pid: number }[]>`
              SELECT pid FROM pg_stat_activity
              WHERE datname = current_database() AND ${holderPid} = ANY(pg_blocking_pids(pid))
                AND query ~* 'mock_exams'
            `,
              { interval: 10, timeout: 4000 },
            )
            .not.toHaveLength(0);

          vi.setSystemTime(new Date("2030-01-01T12:00:00Z"));
        } finally {
          release.resolve(null);
          await reading;
        }

        await expect(reading).resolves.toStrictEqual([{ status: "fulfilled", value: null }]);
      } finally {
        release.resolve(null);
        await held;
      }

      await expect(held).resolves.toMatchObject([{ status: "fulfilled" }]);
    },
  );

  it("uses the same fact for progress and each goal's own local day without writing", async () => {
    const user = await userFixture();

    const [east, west] = await Promise.all([
      goalFixture({ timezone: "Pacific/Kiritimati", userId: user.id }),
      goalFixture({ timezone: "Pacific/Honolulu", userId: user.id }),
    ]);

    await learningProfileFixture({ activeGoalId: west.id, userId: user.id });
    mockSession(user.id);
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2030-01-01T12:00:00Z"));
    vi.spyOn(requestClock, "getRequestInstant").mockResolvedValue(INSTANT);

    /** Exercise the real capability rather than the shared progress tests' date boundary. */
    const { getRequestProgressDateContext } = await vi.importActual<typeof ProgressDateContext>(
      "../../progress/get-request-date-context",
    );

    const reads = await countDatabaseStatements(() =>
      Promise.all([
        getCurrentUserReviewSchedule({ goalId: east.id, timeZone: "UTC" }),
        getCurrentUserReviewSchedule({ goalId: west.id, timeZone: "UTC" }),
        getRequestProgressDateContext(),
      ]),
    );

    expect(reads.writes).toBe(0);
    const [eastSchedule, westSchedule, progress] = reads.result;

    expect(
      eastSchedule.status === "ready" ? eastSchedule.schedule.forecast[0] : null,
    ).toStrictEqual({ localDate: new Date("2026-07-13T00:00:00Z"), reviews: 0 });

    expect(
      westSchedule.status === "ready" ? westSchedule.schedule.forecast[0] : null,
    ).toStrictEqual({ localDate: new Date("2026-07-12T00:00:00Z"), reviews: 0 });

    expect(progress).toStrictEqual({
      currentDate: new Date("2026-07-12T00:00:00Z"),
      currentInstant: INSTANT,
      timeZone: "Pacific/Honolulu",
    });
  });

  it("reads a visitor's UTC context at that instant without accessing learner rows", async () => {
    mockSession(null);
    vi.spyOn(requestClock, "getRequestInstant").mockResolvedValue(INSTANT);

    const { getRequestProgressDateContext } = await vi.importActual<typeof ProgressDateContext>(
      "../../progress/get-request-date-context",
    );

    const reads = await countDatabaseStatements(getRequestProgressDateContext);

    expect(reads).toStrictEqual({
      result: {
        currentDate: new Date("2026-07-12T00:00:00Z"),
        currentInstant: INSTANT,
        timeZone: "UTC",
      },
      statements: 0,
      writes: 0,
    });
  });

  it("uses that goal-local day for stored Today priority without building or writing", async () => {
    const user = await userFixture();
    const goal = await goalFixture({ timezone: "Pacific/Kiritimati", userId: user.id });

    const session = await studySessionFixture({
      goalId: goal.id,
      localDate: new Date("2026-07-13T00:00:00Z"),
      userId: user.id,
    });

    await Promise.all([
      studySessionBlockFixture({
        payload: { planItemId: "pending-item" },
        position: 0,
        sessionId: session.id,
        status: "pending",
      }),
      studySessionBlockFixture({
        payload: { planItemId: "active-item" },
        position: 1,
        sessionId: session.id,
        status: "active",
      }),
    ]);

    mockSession(user.id);
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2030-01-01T12:00:00Z"));
    vi.spyOn(requestClock, "getRequestInstant").mockResolvedValue(INSTANT);

    const reads = await countDatabaseStatements(() => loadTodayLearnBlocks(goal));

    expect(reads.writes).toBe(0);

    expect(reads.result).toStrictEqual([
      { lessonId: null, planItemId: "active-item" },
      { lessonId: null, planItemId: "pending-item" },
    ]);
  });
});
