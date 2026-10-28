import { prisma } from "@zoonk/db";
import { mandatoryNoticeDayFixture } from "@zoonk/testing/fixtures/study-sessions";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { countDatabaseStatements } from "@zoonk/testing/statement-counter";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { openStudyDay } from "../sessions/open-study-day";
import { getTodayView } from "../view-models/today/get-today-view";
import { planLibraryFixture, unplannedGoalFixture } from "./_test-utils/plan-library";
import { createGoalPlan } from "./create-goal-plan";
import { parsePlanSettings } from "./planner/plan-state";

const START = new Date("2020-09-28T12:00:00Z");
const RETURN = new Date("2020-10-20T12:00:00Z");

async function returnAfterTarget({
  fullCourse,
  kind,
}: {
  fullCourse: boolean;
  kind: "exam" | "learn";
}) {
  const user = await userFixture();

  const library = await planLibraryFixture({
    skills: [
      { area: "Atoms", lessons: 6 },
      { area: "Light", builds: 0, lessons: 6 },
    ],
  });

  const fixture = await unplannedGoalFixture({
    dailyMinutes: 5,
    details: { placementDeclined: true },
    kind,
    settings: { fullCourse, startDate: "2020-09-28" },
    targetDate: new Date("2020-10-19"),
    timezone: "UTC",
    userId: user.id,
  });

  await prisma.subscription.create({
    data: { plan: "plus", provider: "zoonk", referenceId: user.id, status: "active" },
  });

  await createGoalPlan({ goalId: fixture.goal.id, graph: library.graph });

  const first = await prisma.planItem.findFirstOrThrow({
    orderBy: { position: "asc" },
    where: { kind: "lesson", planId: fixture.plan.id },
  });

  await prisma.planItem.update({ data: { status: "done" }, where: { id: first.id } });
  mockSession(user.id);
  vi.setSystemTime(RETURN);
  return { ...fixture, user };
}

describe("past-date notice eligibility", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(START);
  });

  afterEach(() => vi.useRealTimers());

  it.each(["exam", "learn"] as const)(
    "keeps the %s past-date recovery quiet both before and after the explicit empty Open",
    async (kind) => {
      const fixture = await returnAfterTarget({ fullCourse: false, kind });

      const before = await prisma.plan.findUniqueOrThrow({
        include: { items: true },
        where: { id: fixture.plan.id },
      });

      const read = await countDatabaseStatements(() =>
        getTodayView({ goalId: fixture.goal.id, timeZone: "UTC" }),
      );

      expect(read.writes).toBe(0);
      expect(read.result.status).toBe("ready");

      if (read.result.status !== "ready") {
        throw new Error("Expected the after-target Today");
      }

      expect(read.result.today.planChange).toBeNull();

      await expect(
        prisma.plan.findUniqueOrThrow({ include: { items: true }, where: { id: fixture.plan.id } }),
      ).resolves.toStrictEqual(before);

      await expect(
        openStudyDay({
          goalId: fixture.goal.id,
          keepEmpty: true,
          shownDate: "2020-10-20",
          timeZone: "UTC",
        }),
      ).resolves.toMatchObject({ status: "opened" });

      await expect(
        prisma.planChange.findMany({ where: { planId: fixture.plan.id, status: "applied" } }),
      ).resolves.toStrictEqual(
        expect.arrayContaining([expect.objectContaining({ kind: "missedDays" })]),
      );

      const after = await countDatabaseStatements(() =>
        getTodayView({ goalId: fixture.goal.id, timeZone: "UTC" }),
      );

      expect(after.writes).toBe(0);
      expect(after.result).toMatchObject({ status: "ready", today: { planChange: null } });
    },
  );

  // Past the exam's date the plan has no date to put at risk, so settling missed days asks nothing:
  // Open saves it for the Plan's history, and Today stays quiet.
  it("settles missed days quietly when the learner explicitly studies an exam course beyond its date", async () => {
    const user = await userFixture();

    const fixture = await mandatoryNoticeDayFixture({
      localDate: new Date("2026-10-14"),
      userId: user.id,
    });

    await prisma.goal.update({
      data: { kind: "exam", targetDate: new Date("2026-10-13") },
      where: { id: fixture.goal.id },
    });

    await prisma.plan.update({
      data: { settings: { ...parsePlanSettings(fixture.plan.settings), fullCourse: true } },
      where: { id: fixture.plan.id },
    });

    mockSession(user.id);
    vi.setSystemTime(new Date("2026-10-14T12:00:00Z"));

    const read = await countDatabaseStatements(() =>
      getTodayView({ goalId: fixture.goal.id, timeZone: "UTC" }),
    );

    expect(read.writes).toBe(0);
    expect(read.result).toMatchObject({ status: "ready", today: { planChange: null } });

    await expect(
      openStudyDay({
        goalId: fixture.goal.id,
        keepEmpty: true,
        shownDate: "2026-10-14",
        timeZone: "UTC",
      }),
    ).resolves.toMatchObject({ status: "opened" });

    const [saved, changes] = await Promise.all([
      getTodayView({ goalId: fixture.goal.id, timeZone: "UTC" }),
      prisma.planChange.findMany({ where: { planId: fixture.plan.id, status: "applied" } }),
    ]);

    expect(saved).toMatchObject({ status: "ready", today: { planChange: null } });
    expect(changes).toStrictEqual([expect.objectContaining({ kind: "missedDays" })]);
  });
});
