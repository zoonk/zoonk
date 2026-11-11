import { prisma } from "@zoonk/db";
import { planItemFixture } from "@zoonk/testing/fixtures/goals";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { loadGoalPlan } from "../learner/_utils/goal-skill-graph";
import { planLibraryFixture, unplannedGoalFixture } from "../plans/_test-utils/plan-library";
import { createGoalPlan } from "../plans/create-goal-plan";
import { parsePlanGraph, parsePlanPhases } from "../plans/planner/plan-state";
import { loadSessionBosses } from "./_utils/load-boss";
import { requestChallengeQuestions } from "./challenge-questions";

const NOW = new Date("2020-09-28T12:00:00Z");

describe("a challenge before a skill's core is in", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps a skill taught before the exam in the day's challenge and question preparation", async () => {
    const user = await userFixture();
    const library = await planLibraryFixture({ skills: [{ lessons: 6 }, { lessons: 3 }] });

    const { goal, plan } = await unplannedGoalFixture({
      kind: "exam",
      targetDate: new Date("2020-10-10T00:00:00Z"),
      timezone: "UTC",
      userId: user.id,
    });

    const settings = { fullCourse: true, startDate: "2020-09-28" };
    await prisma.plan.update({ data: { graph: library.graph, settings }, where: { id: plan.id } });
    const [first, second] = library.skills;

    const created = await Promise.all([
      planItemFixture({
        kind: "lesson",
        lessonId: library.lessons[0]!.id,
        planId: plan.id,
        position: 0,
        scheduledFor: new Date("2020-09-27T00:00:00Z"),
        skillId: first!.id,
        status: "done",
      }),
      planItemFixture({
        kind: "lesson",
        lessonId: library.lessons[6]!.id,
        planId: plan.id,
        position: 1,
        scheduledFor: new Date("2020-09-27T00:00:00Z"),
        skillId: second!.id,
        status: "done",
      }),
      planItemFixture({
        kind: "boss",
        phase: 0,
        planId: plan.id,
        position: 2,
        scheduledFor: new Date("2020-09-28T00:00:00Z"),
      }),
      planItemFixture({
        kind: "lesson",
        lessonId: library.lessons[1]!.id,
        phase: 1,
        planId: plan.id,
        position: 3,
        scheduledFor: new Date("2020-10-11T00:00:00Z"),
        skillId: first!.id,
      }),
    ]);

    mockSession(user.id);
    const saved = await loadGoalPlan(goal.id);

    const day = await loadSessionBosses({
      examBlueprintId: null,
      goal,
      graphSkills: library.graph.skills,
      itemSkillIds: new Map(saved.items.map((item) => [item.id, item.skillIds])),
      items: await prisma.planItem.findMany({
        orderBy: { position: "asc" },
        where: { planId: plan.id },
      }),
      listeningSkillIds: new Set(),
      phases: [],
      skills: saved.skills,
      today: new Date("2020-09-28T00:00:00Z"),
      userId: user.id,
    });

    expect(day.checkpoints[0]?.skillIds).toStrictEqual([first!.id, second!.id]);
    expect(day.checkpoints[0]?.minutes).toBe(15);
    const writing = await requestChallengeQuestions({ planItemId: created[2]!.id });
    expect(writing.status).toBe("start");

    expect(
      writing.status === "start" ? writing.writes.flatMap((write) => write.skillIds) : [],
    ).toStrictEqual([first!.id, second!.id]);
  });

  it("keeps finished-core selection stable when only the challenge estimate moves", async () => {
    const user = await userFixture();

    const library = await planLibraryFixture({
      phases: ["Basics", "Next steps"],
      skills: [
        { lessons: 3, phase: 0 },
        { lessons: 9, phase: 0, size: 3 },
        { lessons: 3, phase: 1 },
      ],
    });

    const { goal, plan } = await unplannedGoalFixture({
      dailyMinutes: 12,
      settings: { startDate: "2020-09-28" },
      timezone: "UTC",
      userId: user.id,
    });

    await createGoalPlan({ goalId: goal.id, graph: library.graph });
    mockSession(user.id);

    const [finished, begun] = library.graph.skills.map((skill) => skill.skillId);
    const saved = await prisma.plan.findUniqueOrThrow({ where: { id: plan.id } });
    const counted = parsePlanGraph(saved.graph).skills.find((skill) => skill.skillId === begun);

    expect(counted).toMatchObject({ lessons: 3, plannedLessons: 9 });

    const items = await prisma.planItem.findMany({
      orderBy: { position: "asc" },
      where: { planId: plan.id },
    });

    const today = items.find((item) => item.skillId === begun)?.scheduledFor;
    const boss = items.find((item) => item.kind === "boss" && item.phase === 0);

    expect(
      items.filter((item) => item.skillId === finished).map((item) => item.scheduledFor),
    ).toStrictEqual([today, today, today]);

    await prisma.planItem.update({ data: { scheduledFor: today }, where: { id: boss?.id } });

    await prisma.planItem.updateMany({
      data: { status: "done" },
      where: { kind: "lesson", planId: plan.id, position: { lt: boss!.position } },
    });

    const goalPlan = await loadGoalPlan(goal.id);

    const day = await loadSessionBosses({
      examBlueprintId: null,
      goal,
      graphSkills: parsePlanGraph(saved.graph).skills,
      itemSkillIds: new Map(goalPlan.items.map((item) => [item.id, item.skillIds])),
      items: await prisma.planItem.findMany({
        orderBy: { position: "asc" },
        where: { planId: plan.id },
      }),
      listeningSkillIds: new Set(),
      phases: parsePlanPhases(saved.phases),
      skills: goalPlan.skills,
      today: today!,
      userId: user.id,
    });

    expect(day.checkpoints.find((checkpoint) => checkpoint.phase === 0)?.skillIds).toStrictEqual([
      finished,
      begun,
    ]);

    const writing = await requestChallengeQuestions({ planItemId: boss?.id ?? "" });

    const written =
      writing.status === "start" ? writing.writes.flatMap((write) => write.skillIds) : [];

    expect(written).toStrictEqual([finished, begun]);
  });
});
