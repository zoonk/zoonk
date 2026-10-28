import { prisma } from "@zoonk/db";
import { studySessionFixture } from "@zoonk/testing/fixtures/study-sessions";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { planLibraryFixture, unplannedGoalFixture } from "./_test-utils/plan-library";
import { createGoalPlan } from "./create-goal-plan";
import { decidePlanChange } from "./decide-plan-change";
import { refreshGoalPlan } from "./refresh-goal-plan";

const DAY = 86_400_000;

/** A Sunday in 2020, before the learning events other tests write, which estimates read. */
const SUNDAY = new Date("2020-09-27T12:00:00Z");

async function setup({ dailyMinutes, lessons }: { dailyMinutes: number; lessons: number[] }) {
  const user = await userFixture();

  const library = await planLibraryFixture({
    phases: lessons.map((_, phase) => `Phase ${phase + 1}`),
    skills: lessons.map((count, phase) => ({ lessons: count, phase })),
  });

  const { goal, plan } = await unplannedGoalFixture({
    dailyMinutes,
    settings: { startDate: "2020-09-27" },
    targetDate: new Date("2020-12-31T00:00:00Z"),
    timezone: "UTC",
    userId: user.id,
  });

  await createGoalPlan({ goalId: goal.id, graph: library.graph });
  mockSession(user.id);

  return { goal, library, plan };
}

async function comeBack({ days, goalId }: { days: number; goalId: string }) {
  vi.setSystemTime(new Date(SUNDAY.getTime() + days * DAY));
  await refreshGoalPlan({ goalId });
}

async function studyToday({
  goal,
  planId,
}: {
  goal: { id: string; userId: string };
  planId: string;
}) {
  const now = new Date();

  const next = await prisma.planItem.findFirstOrThrow({
    orderBy: { position: "asc" },
    where: { kind: "lesson", planId, status: "todo" },
  });

  await Promise.all([
    prisma.planItem.update({ data: { completedAt: now, status: "done" }, where: { id: next.id } }),
    studySessionFixture({
      goalId: goal.id,
      localDate: new Date(`${now.toISOString().slice(0, 10)}T00:00:00Z`),
      userId: goal.userId,
    }),
  ]);
}

async function readPhaseEnds(planId: string): Promise<Map<string, string | null>> {
  const plan = await prisma.plan.findUniqueOrThrow({ where: { id: planId } });
  const phases = plan.phases as { endDate: string | null; name: string }[];

  return new Map(phases.map((phase) => [phase.name, phase.endDate]));
}

async function readProposal(planId: string) {
  const proposal = await prisma.planChange.findFirst({
    where: { payload: { equals: "phaseDates", path: ["source"] }, planId, status: "proposed" },
  });

  const payload = proposal?.payload as
    | { effect?: { phaseEnds?: { after: string; before: string; name: string }[] } }
    | undefined;

  return { moves: payload?.effect?.phaseEnds ?? [], proposal };
}

async function setupAwayAfterStudying() {
  const plan = await setup({ dailyMinutes: 12, lessons: [8, 8, 8, 8] });

  await studyToday({ goal: plan.goal, planId: plan.plan.id });
  await comeBack({ days: 7, goalId: plan.goal.id });

  return plan;
}

describe("a phase's challenge after missed days", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(SUNDAY);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("comes after the lessons it tests, moving the later phase ends it would pass", async () => {
    const { goal, library, plan } = await setup({ dailyMinutes: 24, lessons: [3, 3, 3, 3, 3] });

    await comeBack({ days: 2, goalId: goal.id });

    const phaseOf = new Map(library.graph.skills.map((skill) => [skill.skillId, skill.phase]));
    const items = await prisma.planItem.findMany({ where: { planId: plan.id, status: "todo" } });

    const lessonsAfter = items
      .filter((boss) => boss.kind === "boss" && boss.phase < library.graph.phases.length - 1)
      .flatMap((boss) =>
        items.filter(
          (item) =>
            item.kind === "lesson" &&
            phaseOf.get(item.skillId ?? "") === boss.phase &&
            item.scheduledFor !== null &&
            boss.scheduledFor !== null &&
            item.scheduledFor > boss.scheduledFor,
        ),
      );

    expect(lessonsAfter).toStrictEqual([]);
  });

  it("names each move on Today's card from the end the plan it comes with shows", async () => {
    const { plan } = await setupAwayAfterStudying();
    const ends = await readPhaseEnds(plan.id);
    const { moves } = await readProposal(plan.id);

    expect(moves.length).toBeGreaterThan(0);
    expect(moves.filter((move) => move.before !== ends.get(move.name))).toStrictEqual([]);
  });

  it("asks again once a run moves an end the learner kept", async () => {
    const { goal, plan } = await setupAwayAfterStudying();
    const kept = await readProposal(plan.id);

    await decidePlanChange({
      changeId: kept.proposal?.id ?? "",
      goalId: goal.id,
      input: { status: "declined", timeZone: "UTC" },
    });

    await studyToday({ goal, planId: plan.id });
    await comeBack({ days: 13, goalId: goal.id });

    const ends = await readPhaseEnds(plan.id);
    const { moves, proposal } = await readProposal(plan.id);

    expect(kept.moves.some((move) => move.before !== ends.get(move.name))).toBe(true);
    expect(proposal).not.toBeNull();
    expect(moves.filter((move) => move.before !== ends.get(move.name))).toStrictEqual([]);
  });
});
