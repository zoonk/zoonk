import { prisma } from "@zoonk/db";
import { planChangeFixture } from "@zoonk/testing/fixtures/goals";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { planLibraryFixture, unplannedGoalFixture } from "../_test-utils/plan-library";
import { createGoalPlan } from "../create-goal-plan";
import { addDays, toIsoDate } from "../planner/plan-calendar";
import { parsePlanPhases, parsePlanSettings } from "../planner/plan-state";
import { refreshGoalPlan } from "../refresh-goal-plan";
import { loadTodayPlanChange } from "./today-plan-change";

const NOW = new Date("2020-09-28T12:00:00Z");

describe("proposal effects on Today", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  });

  afterEach(() => vi.useRealTimers());

  it("previews a proposed rest day without applying or saving it", async () => {
    const user = await userFixture();
    const library = await planLibraryFixture({ skills: [{ area: "Math", lessons: 24 }] });

    const { goal, plan } = await unplannedGoalFixture({
      dailyMinutes: 6,
      settings: { startDate: "2020-09-28" },
      userId: user.id,
    });

    await createGoalPlan({ goalId: goal.id, graph: library.graph });

    const proposal = await planChangeFixture({
      kind: "edited",
      payload: {
        operations: [{ kind: "setWeekdayMinutes", minutes: 0, weekdays: [6] }],
        source: "memory",
      },
      planId: plan.id,
      status: "proposed",
    });

    const before = await prisma.plan.findUniqueOrThrow({
      include: { items: true },
      where: { id: plan.id },
    });

    const today = await loadTodayPlanChange({ goal, now: NOW });

    expect(today).toMatchObject({ id: proposal.id, status: "proposed" });
    expect(today?.effect).not.toBeNull();
    expect(today?.effect?.endDateBefore).toBeTruthy();
    expect(today?.effect?.endDateAfter).not.toBe(today?.effect?.endDateBefore);

    await expect(
      prisma.plan.findUniqueOrThrow({ include: { items: true }, where: { id: plan.id } }),
    ).resolves.toStrictEqual(before);

    await expect(
      prisma.planChange.findUniqueOrThrow({ where: { id: proposal.id } }),
    ).resolves.toStrictEqual(proposal);
  });

  it("previews the held phase end a rest day moves without applying or saving it", async () => {
    const user = await userFixture();

    const library = await planLibraryFixture({
      phases: ["First interviews", "Practice"],
      skills: [
        { area: "Interviews", lessons: 0, phase: 0, size: 12 },
        { area: "Interviews", lessons: 0, phase: 1, size: 60 },
      ],
    });

    const { goal, plan } = await unplannedGoalFixture({
      dailyMinutes: 12,
      settings: { startDate: "2020-09-28" },
      timezone: "UTC",
      userId: user.id,
    });

    await createGoalPlan({ goalId: goal.id, graph: library.graph });

    const saved = await prisma.plan.findUniqueOrThrow({ where: { id: plan.id } });
    const end = parsePlanPhases(saved.phases)[0]?.endDate;

    if (!end) {
      throw new Error("Expected the real first phase to have a saved end");
    }

    const endDay = new Date(`${end}T00:00:00Z`);
    const restDay = endDay.getUTCDay();

    await expect(
      prisma.planItem.findFirst({ where: { kind: "boss", phase: 0, planId: plan.id } }),
    ).resolves.toMatchObject({ scheduledFor: endDay, status: "todo" });

    await prisma.plan.update({
      data: {
        settings: {
          ...parsePlanSettings(saved.settings),
          weekdayMinutes: Array.from({ length: 7 }, (_, day) => (day === restDay ? 0 : 12)),
        },
      },
      where: { id: plan.id },
    });

    const proposal = await planChangeFixture({
      kind: "edited",
      payload: { operations: [{ kind: "fitPhaseDates" }], source: "phaseDates" },
      planId: plan.id,
      status: "proposed",
    });

    const before = await prisma.plan.findUniqueOrThrow({
      include: { items: true },
      where: { id: plan.id },
    });

    const goalBefore = await prisma.goal.findUniqueOrThrow({ where: { id: goal.id } });

    // Superseded by C2's next-study-day rule: every run moves this end, so the optional proposal
    // moves nothing more and isn't offered; the refresh's notice says the move instead.
    await expect(loadTodayPlanChange({ goal, now: NOW })).resolves.toBeNull();

    await expect(
      prisma.plan.findUniqueOrThrow({ include: { items: true }, where: { id: plan.id } }),
    ).resolves.toStrictEqual(before);

    await expect(prisma.goal.findUniqueOrThrow({ where: { id: goal.id } })).resolves.toStrictEqual(
      goalBefore,
    );

    await expect(
      prisma.planChange.findUniqueOrThrow({ where: { id: proposal.id } }),
    ).resolves.toStrictEqual(proposal);

    await refreshGoalPlan({ goalId: goal.id });

    const today = await loadTodayPlanChange({ goal, now: NOW });

    expect(today).toMatchObject({ kind: "estimateUpdated", status: "applied" });

    expect(today?.effect?.phaseEnds).toStrictEqual([
      // The challenge's day became a rest day: the phase's last lessons take the day after it, and
      // the challenge comes the first study day after them.
      {
        after: toIsoDate(addDays(endDay, 2)),
        before: end,
        lessonsFirst: true,
        name: "First interviews",
      },
    ]);
  });
});
