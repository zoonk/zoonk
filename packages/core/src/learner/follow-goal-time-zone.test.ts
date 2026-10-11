import { prisma } from "@zoonk/db";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { attemptFixture } from "@zoonk/testing/fixtures/learner";
import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { describe, expect, it } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { getStudySession } from "../sessions/get-study-session";
import { getAnswerTimeZone } from "./_utils/owned-goal";
import { followGoalTimeZone } from "./follow-goal-time-zone";

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

describe("following a learner who moves", () => {
  it("moves the goal's day to the device's zone while nothing was done today", async () => {
    const { goal } = await setup();
    const zone = zoneOnAnotherDay();

    await expect(followGoalTimeZone({ goalId: goal.id, timeZone: zone })).resolves.toStrictEqual({
      moved: true,
      status: "ready",
    });

    await expect(readZone(goal.id)).resolves.toBe(zone);
  });

  it("keeps the goal's zone until the next day once the learner answered today", async () => {
    const { goal, user } = await setup();
    await attemptFixture({ localDate: localDay(SAO_PAULO), userId: user.id });

    await expect(
      followGoalTimeZone({ goalId: goal.id, timeZone: zoneOnAnotherDay() }),
    ).resolves.toStrictEqual({ moved: false, status: "ready" });

    await expect(readZone(goal.id)).resolves.toBe(SAO_PAULO);
  });

  it("keeps the goal's zone once a block of today's session was opened", async () => {
    const { goal, session } = await setup();

    await studySessionBlockFixture({
      sessionId: session.id,
      startedAt: new Date(),
      status: "active",
    });

    await expect(
      followGoalTimeZone({ goalId: goal.id, timeZone: zoneOnAnotherDay() }),
    ).resolves.toStrictEqual({ moved: false, status: "ready" });

    await expect(readZone(goal.id)).resolves.toBe(SAO_PAULO);
  });

  it("stores the device's zone on a goal without one, and ignores a zone that isn't one", async () => {
    const { goal } = await setup({ timezone: null });

    await expect(
      followGoalTimeZone({ goalId: goal.id, timeZone: "Mars/Olympus" }),
    ).resolves.toStrictEqual({ moved: false, status: "ready" });

    await expect(
      followGoalTimeZone({ goalId: goal.id, timeZone: SAO_PAULO }),
    ).resolves.toStrictEqual({ moved: true, status: "ready" });

    await expect(readZone(goal.id)).resolves.toBe(SAO_PAULO);
  });

  it("says another learner's goal isn't found", async () => {
    const { goal } = await setup();
    const other = await userFixture();
    mockSession(other.id);

    await expect(followGoalTimeZone({ goalId: goal.id, timeZone: "UTC" })).resolves.toStrictEqual({
      status: "notFound",
    });
  });
});
