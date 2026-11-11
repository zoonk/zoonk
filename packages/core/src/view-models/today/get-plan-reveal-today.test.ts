import { prisma } from "@zoonk/db";
import { layOutPlanFixture } from "@zoonk/testing/fixtures/goals";
import { attemptFixture } from "@zoonk/testing/fixtures/learner";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { countDatabaseStatements } from "@zoonk/testing/statement-counter";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../../_test-utils/mock-session";
import { type readPlannedDay } from "../../learner/facts/planned-day";
import {
  SESSION_NOW,
  daysAgo,
  dueSkillFixture,
  sessionGoalFixture,
} from "../../sessions/_test-utils/session-goal";
import { loadSessionBuildInput } from "../../sessions/_utils/load-build-inputs";
import { getPlanRevealToday } from "./get-plan-reveal-today";
import { getTodayView } from "./get-today-view";

vi.mock("../../sessions/_utils/load-build-inputs", { spy: true });

vi.mock("../../learner/facts/planned-day", async (importOriginal) => {
  const [actual, { keepRequestReads }] = await Promise.all([
    importOriginal<{ readPlannedDay: typeof readPlannedDay }>(),
    import("../../_test-utils/keep-request-reads"),
  ]);

  return { ...actual, readPlannedDay: keepRequestReads(actual.readPlannedDay) };
});

async function revealedGoalWithReviewsDue() {
  const user = await userFixture();

  const { goal, plan, skills } = await sessionGoalFixture({
    challengesDone: true,
    goal: { planRevealedAt: null },
    itemsPerSkill: 20,
    userId: user.id,
  });

  await Promise.all([
    layOutPlanFixture(plan.id),
    ...skills.flatMap((skill) => [
      dueSkillFixture({ skillId: skill.id, userId: user.id }),
      attemptFixture({ answeredAt: daysAgo(4), skillId: skill.id, userId: user.id }),
    ]),
  ]);

  mockSession(user.id);
  return { goal, user };
}

describe(getPlanRevealToday, () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(SESSION_NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shares the planned day between the reveal's Today and Plan without writing", async () => {
    const { goal } = await revealedGoalWithReviewsDue();

    const before = await prisma.plan.findUniqueOrThrow({
      include: { items: { orderBy: { position: "asc" } } },
      where: { goalId: goal.id },
    });

    vi.mocked(loadSessionBuildInput).mockClear();
    const read = await countDatabaseStatements(() => getPlanRevealToday(goal.id, "UTC"));

    expect(read.result.status).toBe("ready");
    expect(read.writes).toBe(0);
    expect(loadSessionBuildInput).toHaveBeenCalledOnce();
    await expect(prisma.studySession.count({ where: { goalId: goal.id } })).resolves.toBe(0);

    await expect(
      prisma.plan.findUniqueOrThrow({
        include: { items: { orderBy: { position: "asc" } } },
        where: { goalId: goal.id },
      }),
    ).resolves.toStrictEqual(before);
  });

  it("shows the day Today will show, its review included, before the plan is seen, writing nothing", async () => {
    const { goal } = await revealedGoalWithReviewsDue();

    await expect(getTodayView({ goalId: goal.id, timeZone: "UTC" })).resolves.toMatchObject({
      status: "preparing",
    });

    const reveal = await countDatabaseStatements(() => getPlanRevealToday(goal.id, "UTC"));

    expect(reveal.writes).toBe(0);
    await expect(prisma.studySession.count({ where: { goalId: goal.id } })).resolves.toBe(0);

    await prisma.goal.update({ data: { planRevealedAt: new Date() }, where: { id: goal.id } });
    const today = await getTodayView({ goalId: goal.id, timeZone: "UTC" });

    if (reveal.result.status !== "ready" || today.status !== "ready") {
      throw new Error("Expected both days to be ready");
    }

    const { minutes, nextDays, today: revealToday } = reveal.result.reveal;
    expect(revealToday.blocks.map((block) => block.kind)).toContain("review");
    expect(revealToday).toStrictEqual(today.today.session);

    expect(minutes).toBe(
      revealToday.blocks.reduce((sum, block) => sum + block.estimatedMinutes, 0),
    );

    expect(nextDays.length).toBeLessThanOrEqual(6);
    expect(nextDays.every((day) => new Date(day.date) > revealToday.localDate)).toBe(true);
  });

  it("answers as Today does for a goal with questions left or another learner's goal", async () => {
    const { goal } = await revealedGoalWithReviewsDue();
    const other = await userFixture();

    await prisma.goal.update({
      data: { details: { answered: [], placementDeclined: true } },
      where: { id: goal.id },
    });

    await expect(getPlanRevealToday(goal.id, "UTC")).resolves.toMatchObject({
      goal: { id: goal.id },
      status: "preparing",
    });

    mockSession(other.id);
    await expect(getPlanRevealToday(goal.id, "UTC")).resolves.toStrictEqual({ status: "notFound" });
  });
});
