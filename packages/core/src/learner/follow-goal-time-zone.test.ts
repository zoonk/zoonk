import { prisma } from "@zoonk/db";
import { goalFixture, planFixture } from "@zoonk/testing/fixtures/goals";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { studySessionFixture } from "@zoonk/testing/fixtures/study-sessions";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { sessionGoalFixture } from "../sessions/_test-utils/session-goal";
import { getStudySession } from "../sessions/get-study-session";
import { type TodayViewResult, getTodayView } from "../view-models/today/get-today-view";
import { markLearnerChanged } from "./_utils/mark-learner-changed";
import { getAnswerTimeZone } from "./_utils/owned-goal";
import { isTimeZoneUnchanged, moveGoalTimeZoneInTransaction } from "./follow-goal-time-zone";

const SAO_PAULO = "America/Sao_Paulo";

function localDay(timeZone: string): Date {
  return getDateInTimeZone({ date: new Date(), timeZone });
}

/** A zone whose day isn't São Paulo's right now: far ahead of it, or far behind it early on. */
function zoneOnAnotherDay(): string {
  const zones = ["Pacific/Kiritimati", "Pacific/Pago_Pago"];
  return zones.find((zone) => localDay(zone).getTime() !== localDay(SAO_PAULO).getTime()) ?? "UTC";
}

/** Ana: her goal lives in São Paulo, and today's session there is built, not opened yet. */
async function setup({ timezone = SAO_PAULO }: { timezone?: string | null } = {}) {
  const user = await userFixture();
  const goal = await goalFixture({ timezone, userId: user.id });

  const session = await studySessionFixture({
    goalId: goal.id,
    localDate: localDay(timezone ?? "UTC"),
    userId: user.id,
  });

  mockSession(user.id);

  return { goal, session, user };
}

async function readZone(goalId: string) {
  const goal = await prisma.goal.findUniqueOrThrow({ where: { id: goalId } });
  return goal.timezone;
}

/** The goal a Today read is about, its day ready or still preparing. */
function todayGoalId(result: TodayViewResult): string | null {
  if (result.status === "ready") {
    return result.today.goal.id;
  }

  return "goal" in result ? result.goal.id : null;
}

/** The goal plan's input version, as writers raise it. */
function readVersions({ planId }: { planId: string; userId: string }) {
  return prisma.plan.findUniqueOrThrow({ select: { inputVersion: true }, where: { id: planId } });
}

describe("the learner's day", () => {
  it("is the goal's stored zone, and the request's only for a goal without one", () => {
    expect(getAnswerTimeZone({ goal: { timezone: SAO_PAULO }, timeZone: "UTC" })).toBe(SAO_PAULO);

    expect(getAnswerTimeZone({ goal: { timezone: null }, timeZone: "Asia/Tokyo" })).toBe(
      "Asia/Tokyo",
    );

    expect(getAnswerTimeZone({ goal: null, timeZone: null })).toBe("UTC");
  });

  it("keeps today's session current on a device in another zone, so Continue opens it", async () => {
    const { session } = await setup();

    const result = await getStudySession({
      input: { timeZone: zoneOnAnotherDay() },
      sessionId: session.id,
    });

    expect(result).toMatchObject({ session: { current: true }, status: "ready" });
  });
});

describe("Today on another device", () => {
  it("reads the active goal without moving it when the request names none", async () => {
    const { goal: other, user } = await setup();

    const { goal: active } = await sessionGoalFixture({
      goal: { timezone: SAO_PAULO },
      userId: user.id,
    });

    await learningProfileFixture({ activeGoalId: active.id, userId: user.id });
    const zone = zoneOnAnotherDay();

    expect(todayGoalId(await getTodayView({ timeZone: zone }))).toBe(active.id);

    await expect(Promise.all([readZone(active.id), readZone(other.id)])).resolves.toStrictEqual([
      SAO_PAULO,
      SAO_PAULO,
    ]);
  });

  it("follows nothing for a learner without a goal", async () => {
    const user = await userFixture();
    mockSession(user.id);

    await expect(getTodayView({ timeZone: "UTC" })).resolves.toMatchObject({ status: "noGoal" });
  });
});

describe("moving a goal's zone inside a writer's transaction", () => {
  it("writes nothing for a goal already in that zone", async () => {
    const { goal, user } = await setup();
    const plan = await planFixture({ goalId: goal.id });
    const before = await readVersions({ planId: plan.id, userId: user.id });

    await expect(
      prisma.$transaction((tx) =>
        moveGoalTimeZoneInTransaction(tx, {
          fromZone: SAO_PAULO,
          goalId: goal.id,
          toZone: SAO_PAULO,
          userId: user.id,
        }),
      ),
    ).resolves.toMatchObject({ kind: "unchanged" });

    await expect(readVersions({ planId: plan.id, userId: user.id })).resolves.toStrictEqual(before);
  });

  it("reads only through the writer's transaction, which may hold the last free connection", async () => {
    const { goal, user } = await setup();

    const reads = [
      vi.spyOn(prisma.attempt, "findFirst"),
      vi.spyOn(prisma.studySessionBlock, "findFirst"),
    ];

    try {
      await expect(
        prisma.$transaction((tx) =>
          moveGoalTimeZoneInTransaction(tx, {
            fromZone: SAO_PAULO,
            goalId: goal.id,
            toZone: zoneOnAnotherDay(),
            userId: user.id,
          }),
        ),
      ).resolves.toMatchObject({ kind: "moved" });

      for (const read of reads) {
        expect(read).not.toHaveBeenCalled();
      }
    } finally {
      for (const read of reads) {
        read.mockRestore();
      }
    }
  });

  it("rolls its marks back when another writer moved the zone first, which keeps its own", async () => {
    const { goal, user } = await setup();
    const plan = await planFixture({ goalId: goal.id });

    // Another writer moved the goal to Tokyo after this one read São Paulo.
    await prisma.goal.update({ data: { timezone: "Asia/Tokyo" }, where: { id: goal.id } });
    const before = await readVersions({ planId: plan.id, userId: user.id });

    const lost = await prisma
      .$transaction((tx) =>
        moveGoalTimeZoneInTransaction(tx, {
          fromZone: SAO_PAULO,
          goalId: goal.id,
          toZone: zoneOnAnotherDay(),
          userId: user.id,
        }),
      )
      .catch((error: unknown) => error);

    // The caller tells this rollback from a real failure.
    expect(isTimeZoneUnchanged(lost) && lost.reason).toBe("zoneChanged");
    expect(isTimeZoneUnchanged(new Error("connection lost"))).toBe(false);

    await expect(readZone(goal.id)).resolves.toBe("Asia/Tokyo");
    await expect(readVersions({ planId: plan.id, userId: user.id })).resolves.toStrictEqual(before);
  });

  it("takes the plan's lock before the learner's and the goal's, beside a concurrent plan writer", async () => {
    const { goal, user } = await setup();
    const plan = await planFixture({ goalId: goal.id });
    const locked = Promise.withResolvers<null>();
    const continuePlanWriter = Promise.withResolvers<null>();
    const movePID = Promise.withResolvers<number>();

    // A plan writer holds the plan, then marks the learner and writes the goal row.
    const planWriter = prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM plans WHERE id = ${plan.id}::uuid FOR UPDATE`;
      locked.resolve(null);
      await continuePlanWriter.promise;
      await markLearnerChanged(tx, { planInputs: true, userId: user.id });
      await tx.goal.update({ data: { title: "Moved by the plan" }, where: { id: goal.id } });
    });

    await locked.promise;

    const move = prisma.$transaction(async (tx) => {
      const [backend] = await tx.$queryRaw<{ pid: number }[]>`SELECT pg_backend_pid()::int AS pid`;

      if (!backend) {
        throw new Error("Expected transaction backend");
      }

      movePID.resolve(backend.pid);

      return moveGoalTimeZoneInTransaction(tx, {
        fromZone: SAO_PAULO,
        goalId: goal.id,
        toZone: zoneOnAnotherDay(),
        userId: user.id,
      });
    });

    const pid = await movePID.promise;

    try {
      // The move waits on the plan, before it holds the learner's or the goal's row.
      await expect
        .poll(async () => {
          const [backend] = await prisma.$queryRaw<{ waiting: boolean }[]>`
            SELECT wait_event_type = 'Lock' AS waiting FROM pg_stat_activity WHERE pid = ${pid}
          `;

          return backend?.waiting;
        })
        .toBe(true);
    } finally {
      continuePlanWriter.resolve(null);
    }

    await expect(Promise.all([planWriter, move])).resolves.toMatchObject([
      undefined,
      { kind: "moved", planInputsChanged: true },
    ]);

    await expect(readZone(goal.id)).resolves.toBe(zoneOnAnotherDay());
  });
});
