import { setImmediate } from "node:timers/promises";
import { prisma } from "@zoonk/db";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { dailyProgressFixtureMany, userProgressFixture } from "@zoonk/testing/fixtures/progress";
import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { assertReadBudget, countDatabaseStatements } from "@zoonk/testing/statement-counter";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { freezeClock } from "../_test-utils/frozen-clock";
import { mockGuestSession, mockSession, mockSessionFailure } from "../_test-utils/mock-session";
import * as requestClock from "../learner/facts/request-instant";
import * as progressFacts from "../learner/facts/user-progress";
import { getBeltLevel } from "../progress/get-belt-level";
import * as snapshot from "../sessions/_utils/capture-snapshot";
import { getBuddyStatus } from "./get-buddy-status";

const NOW = new Date("2026-10-15T01:00:00Z");
const TODAY = new Date("2026-10-15T00:00:00Z");
const YESTERDAY = new Date("2026-10-14T00:00:00Z");
const NO_MISSIONS = { picks: [], version: 1 };

describe("Buddy request facts", () => {
  beforeEach(() => {
    freezeClock();
    vi.setSystemTime(NOW);
    mockSession(null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("keeps visitors query-free and propagates session failures", async () => {
    const visitor = await countDatabaseStatements(() => getBuddyStatus({}));

    expect(visitor).toStrictEqual({ result: { status: "unauthorized" }, statements: 0, writes: 0 });

    const failure = new Error("session unavailable");
    mockSessionFailure(failure);

    await expect(getBuddyStatus({})).rejects.toBe(failure);
  });

  it("keeps the default buddy and zero Brain Power for a guest without profile or progress", async () => {
    const user = await userFixture();
    mockGuestSession(user.id);

    const read = await countDatabaseStatements(() => getBuddyStatus({}));

    expect(read.result).toMatchObject({
      buddy: {
        belt: { totalBrainPower: 0 },
        buddy: { glasses: "round", kind: "zu", name: null, picked: false },
        energy: { current: null, studiedToday: false },
        today: null,
      },
      status: "ready",
    });

    assertReadBudget(read, 13);
  });

  it.each(["active", "paused", "completed", "archived"] as const)(
    "keeps the stored owned %s goal for missions and the saved buddy choice",
    async (status) => {
      const user = await userFixture();

      const [selected] = await Promise.all([
        goalFixture({ status, timezone: "UTC", userId: user.id }),
        goalFixture({ createdAt: new Date("2025-01-01"), userId: user.id }),
      ]);

      await Promise.all([
        learningProfileFixture({
          activeGoalId: selected.id,
          buddyGlasses: "round",
          buddyKind: "zu",
          buddyName: "Mochi",
          userId: user.id,
        }),
        studySessionFixture({
          goalId: selected.id,
          localDate: TODAY,
          missions: NO_MISSIONS,
          userId: user.id,
        }),
      ]);

      mockSession(user.id);

      await expect(getBuddyStatus({})).resolves.toMatchObject({
        buddy: {
          buddy: { glasses: "round", kind: "zu", name: "Mochi", picked: true },
          today: { goalId: selected.id, localDate: "2026-10-15", missions: [] },
        },
        status: "ready",
      });
    },
  );

  it("falls back to the earliest owned active goal only without a stored selection", async () => {
    const [owner, other] = await Promise.all([userFixture(), userFixture()]);

    const [first] = await Promise.all([
      goalFixture({ createdAt: new Date("2026-01-01"), timezone: "UTC", userId: owner.id }),
      goalFixture({ createdAt: new Date("2026-02-01"), userId: owner.id }),
      goalFixture({ createdAt: new Date("2025-01-01"), status: "paused", userId: owner.id }),
      goalFixture({ createdAt: new Date("2024-01-01"), userId: other.id }),
    ]);

    await studySessionFixture({
      goalId: first.id,
      localDate: TODAY,
      missions: NO_MISSIONS,
      userId: owner.id,
    });

    mockSession(owner.id);

    await expect(getBuddyStatus({})).resolves.toMatchObject({
      buddy: { today: { goalId: first.id } },
      status: "ready",
    });
  });

  it("does not fall back when the stored selection is no longer owned", async () => {
    const [owner, other] = await Promise.all([userFixture(), userFixture()]);
    const selected = await goalFixture({ timezone: "Pacific/Auckland", userId: other.id });
    const fallback = await goalFixture({ timezone: "UTC", userId: owner.id });

    await Promise.all([
      learningProfileFixture({ activeGoalId: selected.id, userId: owner.id }),
      studySessionFixture({
        goalId: fallback.id,
        localDate: TODAY,
        missions: NO_MISSIONS,
        userId: owner.id,
      }),
    ]);

    mockSession(owner.id);

    await expect(getBuddyStatus({})).resolves.toMatchObject({
      buddy: { today: null },
      status: "ready",
    });
  });

  it.each([undefined, "UTC", "invalid/zone"])(
    "keeps learner-day override %s separate from the goal's mission day",
    async (timeZone) => {
      const user = await userFixture();
      const goal = await goalFixture({ timezone: "America/Sao_Paulo", userId: user.id });

      await Promise.all([
        learningProfileFixture({ activeGoalId: goal.id, userId: user.id }),
        dailyProgressFixtureMany([{ date: TODAY, timeSpentSeconds: 300, userId: user.id }]),
        studySessionFixture({
          goalId: goal.id,
          localDate: YESTERDAY,
          missions: NO_MISSIONS,
          userId: user.id,
        }),
      ]);

      mockSession(user.id);

      await expect(getBuddyStatus({ timeZone })).resolves.toMatchObject({
        buddy: {
          energy: { studiedToday: timeZone !== undefined },
          today: { goalId: goal.id, localDate: "2026-10-14" },
        },
        status: "ready",
      });
    },
  );

  it("keeps the request's carried session when the wall clock later passes its carry end", async () => {
    const user = await userFixture();
    const goal = await goalFixture({ timezone: "UTC", userId: user.id });

    await learningProfileFixture({ activeGoalId: goal.id, userId: user.id });

    const [carried] = await Promise.all([
      studySessionFixture({
        goalId: goal.id,
        localDate: YESTERDAY,
        missions: NO_MISSIONS,
        startedAt: new Date("2026-10-14T23:50:00Z"),
        userId: user.id,
      }),
      studySessionFixture({
        goalId: goal.id,
        localDate: TODAY,
        missions: NO_MISSIONS,
        userId: user.id,
      }),
    ]);

    await studySessionBlockFixture({
      completedAt: new Date("2026-10-15T03:10:00Z"),
      position: 0,
      sessionId: carried.id,
      status: "completed",
    });

    mockSession(user.id);
    vi.setSystemTime(new Date("2026-10-15T04:30:00Z"));
    vi.spyOn(requestClock, "getRequestInstant").mockResolvedValue(new Date("2026-10-15T03:30:00Z"));

    await expect(getBuddyStatus({})).resolves.toMatchObject({
      buddy: { today: { goalId: goal.id, localDate: "2026-10-14" } },
      status: "ready",
    });
  });

  it("keeps a selected goal's empty day within 15 read statements without building a session", async () => {
    const user = await userFixture();
    const goal = await goalFixture({ timezone: "UTC", userId: user.id });
    await learningProfileFixture({ activeGoalId: goal.id, userId: user.id });
    mockSession(user.id);

    const read = await countDatabaseStatements(() => getBuddyStatus({}));

    expect(read.result).toMatchObject({ buddy: { today: null }, status: "ready" });
    assertReadBudget(read, 15);
    await expect(prisma.studySession.count({ where: { userId: user.id } })).resolves.toBe(0);
  });

  it.each([null, 0, 15_000])(
    "shares one progress read for %s Brain Power at a modeled request-cache boundary",
    async (total) => {
      const [owner, other] = await Promise.all([userFixture(), userFixture()]);

      await userProgressFixture({ currentEnergy: 99, totalBrainPower: 50_000n, userId: other.id });

      if (total !== null) {
        await userProgressFixture({
          currentEnergy: total > 0 ? 23 : 0,
          lastActiveAt: new Date("2026-10-12T01:00:00Z"),
          totalBrainPower: BigInt(total),
          userId: owner.id,
        });
      }

      if (total && total > 0) {
        await dailyProgressFixtureMany([
          { date: new Date("2026-10-12T00:00:00Z"), timeSpentSeconds: 60, userId: owner.id },
        ]);
      }

      /** Vitest lacks Next's request cache; retain each first real database fact for this request. */
      const realFact = progressFacts.readUserProgress;
      const requestFacts = new Map<string, ReturnType<typeof realFact>>();

      vi.spyOn(progressFacts, "readUserProgress").mockImplementation((userId) => {
        const cached = requestFacts.get(userId);

        if (cached) {
          return cached;
        }

        const reading = realFact(userId);
        requestFacts.set(userId, reading);
        return reading;
      });

      mockSession(other.id);
      await expect(getBeltLevel()).resolves.toMatchObject({ totalBrainPower: 50_000 });
      mockSession(owner.id);
      const preload = await countDatabaseStatements(getBeltLevel);
      assertReadBudget(preload, 1);
      expect(preload.statements).toBe(1);

      const realMeasure = snapshot.measureProgress;
      const measured = { statements: 0, writes: 0 };

      const measure = vi.spyOn(snapshot, "measureProgress").mockImplementation(async (input) => {
        /** Flush Prisma's sibling findUnique batch before attributing this helper's SQL. */
        await setImmediate();
        const observed = await countDatabaseStatements(() => realMeasure(input));
        measured.statements += observed.statements;
        measured.writes += observed.writes;
        return observed.result;
      });

      const combined = await countDatabaseStatements(() =>
        Promise.all([getBuddyStatus({ timeZone: "UTC" }), getBeltLevel()]),
      );

      const [buddy, belt] = combined.result;

      expect(belt).toStrictEqual(preload.result);
      expect(belt?.totalBrainPower ?? null).toBe(total && total > 0 ? total : null);

      expect(buddy).toMatchObject({
        buddy: {
          belt: { totalBrainPower: total ?? 0 },
          energy: { current: total && total > 0 ? 21 : null, studiedToday: false },
          today: null,
        },
        status: "ready",
      });

      expect(combined.writes).toBe(0);
      expect(measure).toHaveBeenCalledOnce();
      expect(measured.writes).toBe(0);
      expect(preload.statements + measured.statements).toBe(1);
    },
  );
});
