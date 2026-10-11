import { prisma } from "@zoonk/db";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { planLibraryFixture, unplannedGoalFixture } from "../plans/_test-utils/plan-library";
import { createGoalPlan } from "../plans/create-goal-plan";
import { parsePlanGraph } from "../plans/planner/plan-state";
import { getTodayStudySession } from "../sessions/_test-utils/open-today";
import { readBlockPayload } from "../sessions/block-payload";
import { requestChallengeQuestions } from "./challenge-questions";

/** A Monday in 2020, before the learning events other tests write, which estimates read. */
const NOW = new Date("2020-09-28T12:00:00Z");

// Câmara seed 1's first plan: a challenge asked skills begun late before it, whose core lessons
// came after its day (R40). A skill's core is a third of the lessons the plan counted for it
// (`plannedLessons`), not of the graph's estimate: one the graph guessed 26 lessons for has 34 in
// the Library, so its core is 12, not 9. Here the graph guesses 3 lessons for a skill with 9: its
// core is 3, and the challenge comes after its first lesson only.
describe("a challenge before a skill's core is in", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
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

    // The window's time box ends today: after the first skill's lessons and the second's first.
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

    // Its questions are written ahead on the same skill.
    const writing = await requestChallengeQuestions({ planItemId: boss?.id ?? "" });

    const written =
      writing.status === "start" ? writing.writes.flatMap((write) => write.skillIds) : [];

    expect(written).toStrictEqual([finished]);
  });
});
