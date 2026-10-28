import { prisma } from "@zoonk/db";
import { planItemFixture } from "@zoonk/testing/fixtures/goals";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { loadGoalPlan } from "../learner/_utils/goal-skill-graph";
import { planLibraryFixture, unplannedGoalFixture } from "../plans/_test-utils/plan-library";
import { createGoalPlan } from "../plans/create-goal-plan";
import { parsePlanGraph } from "../plans/planner/plan-state";
import { getTodayStudySession } from "../sessions/_test-utils/open-today";
import { readBlockPayload } from "../sessions/block-payload";
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
      }),
      planItemFixture({
        kind: "lesson",
        lessonId: library.lessons[6]!.id,
        planId: plan.id,
        position: 1,
        scheduledFor: new Date("2020-09-27T00:00:00Z"),
        skillId: second!.id,
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

  it("leaves out a skill whose core, as the plan counts it, comes after its day", async () => {
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
      dailyMinutes: 24,
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

    const day = await getTodayStudySession({ goalId: goal.id, timeZone: "UTC" });
    const blocks = day.status === "ready" ? day.session.blocks : [];
    const duel = blocks.find((block) => block.checkpoint?.phase === 0);
    const row = await prisma.studySessionBlock.findUniqueOrThrow({ where: { id: duel?.id } });

    expect(readBlockPayload(row).skillIds).toStrictEqual([finished]);

    const writing = await requestChallengeQuestions({ planItemId: boss?.id ?? "" });

    const written =
      writing.status === "start" ? writing.writes.flatMap((write) => write.skillIds) : [];

    expect(written).toStrictEqual([finished]);
  });
});
