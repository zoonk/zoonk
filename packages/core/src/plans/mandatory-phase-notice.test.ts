import { prisma } from "@zoonk/db";
import { goalFixture, planFixture } from "@zoonk/testing/fixtures/goals";
import { countDatabaseStatements } from "@zoonk/testing/statement-counter";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { openStudyDay } from "../sessions/open-study-day";
import { getTodayView } from "../view-models/today/get-today-view";
import { mandatoryPhasePlanFixture } from "./_test-utils/mandatory-phase-plan";
import { parsePlanChangePayload } from "./_utils/plan-change-payload";

const PRIOR_DAY = new Date("2026-10-13T12:00:00Z");
const NEXT_DAY = new Date("2026-10-14T12:00:00Z");

describe("mandatory phase notices after missed days", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(PRIOR_DAY);
  });

  afterEach(() => vi.useRealTimers());

  it("saves the phase move a missed day makes on Open, and keeps it off Today", async () => {
    const { built, goal, pending, plan, user } = await mandatoryPhasePlanFixture();
    mockSession(user.id);

    expect(built.phases[0]?.endDate).toBe("2026-10-21");

    await expect(
      prisma.planItem.findFirstOrThrow({ where: { kind: "lesson", phase: 0, planId: plan.id } }),
    ).resolves.toMatchObject({
      lessonId: null,
      lessons: null,
      scheduledFor: new Date("2026-10-13T00:00:00Z"),
      status: "todo",
    });

    await expect(
      prisma.planChange.count({ where: { planId: plan.id, status: "applied" } }),
    ).resolves.toBe(0);

    vi.setSystemTime(NEXT_DAY);

    const preview = await countDatabaseStatements(() =>
      getTodayView({ goalId: goal.id, timeZone: "UTC" }),
    );

    expect(preview.writes).toBe(0);
    expect(preview.result.status).toBe("ready");

    if (preview.result.status !== "ready") {
      throw new Error("Expected the mandatory read preview");
    }

    expect(preview.result.today.planChange).toBeNull();

    expect(preview.result.today.session).toMatchObject({
      blocks: [],
      emptyDay: null,
      lessonsComing: false,
      minutes: { dailyGoal: 0 },
    });

    await expect(
      prisma.planChange.count({ where: { planId: plan.id, status: "applied" } }),
    ).resolves.toBe(0);

    const otherGoal = await goalFixture({ userId: user.id });
    const otherPlan = await planFixture({ goalId: otherGoal.id });
    const before = await prisma.plan.findUniqueOrThrow({ where: { id: plan.id } });

    await expect(
      openStudyDay({ goalId: goal.id, keepEmpty: true, shownDate: "2026-10-14", timeZone: "UTC" }),
    ).resolves.toMatchObject({ status: "opened" });

    const result = await getTodayView({ goalId: goal.id, timeZone: "UTC" });
    expect(result.status).toBe("ready");

    const [changes, saved, replaced] = await Promise.all([
      prisma.planChange.findMany({ where: { planId: plan.id, status: "applied" } }),
      prisma.plan.findUniqueOrThrow({ where: { id: plan.id } }),
      prisma.planChange.findUniqueOrThrow({ where: { id: pending.id } }),
    ]);

    expect(changes).toHaveLength(1);
    expect(saved.inputVersion).toBe(before.inputVersion + 1);
    expect(saved.version).toBe(before.version + 1);

    await expect(
      prisma.plan.findUniqueOrThrow({ where: { id: otherPlan.id } }),
    ).resolves.toStrictEqual(otherPlan);

    expect(replaced.status).toBe("replaced");

    const change = changes[0];

    if (!change || result.status !== "ready") {
      throw new Error("Ordinary Today settling must save one real applied change");
    }

    const payload = parsePlanChangePayload(change.payload);

    const phaseEnds = [{ after: "2026-10-24", before: "2026-10-21", name: "First interviews" }];

    expect(change.kind).toBe("missedDays");

    expect(payload).toMatchObject({
      behind: null,
      days: 1,
      effect: { lessonsAdded: 0, lessonsRemoved: 0 },
      source: "system",
    });

    expect(payload.effect?.phaseEnds).toStrictEqual(phaseEnds);

    expect(saved.phases).toStrictEqual(
      expect.arrayContaining([
        expect.objectContaining({ endDate: "2026-10-24", name: "First interviews" }),
      ]),
    );

    await expect(
      prisma.planItem.findFirstOrThrow({ where: { kind: "boss", phase: 0, planId: plan.id } }),
    ).resolves.toMatchObject({ scheduledFor: new Date("2026-10-24T00:00:00Z") });

    expect(result.today.planChange).toBeNull();
    expect(payload.seenAt).toBeNull();
    expect(change.id).toMatch(/^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/u);

    expect(result.today.session).toMatchObject({
      blocks: [],
      emptyDay: null,
      lessonsComing: false,
      minutes: { dailyGoal: 0 },
    });

    await expect(
      prisma.studySessionBlock.count({ where: { session: { goalId: goal.id } } }),
    ).resolves.toBe(0);

    const firstUser = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });

    const replay = await countDatabaseStatements(() =>
      openStudyDay({ goalId: goal.id, keepEmpty: true, shownDate: "2026-10-14", timeZone: "UTC" }),
    );

    expect(replay.result).toMatchObject({ created: false, status: "opened" });
    expect(replay.writes).toBe(0);

    await expect(prisma.plan.findUniqueOrThrow({ where: { id: plan.id } })).resolves.toStrictEqual(
      saved,
    );

    await expect(prisma.user.findUniqueOrThrow({ where: { id: user.id } })).resolves.toStrictEqual(
      firstUser,
    );

    await expect(
      prisma.planChange.findMany({ where: { planId: plan.id, status: "applied" } }),
    ).resolves.toStrictEqual(changes);
  });
});
