import { prisma } from "@zoonk/db";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { chapterSkillFixture } from "@zoonk/testing/fixtures/library-chapters";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { planLibraryFixture, unplannedGoalFixture } from "../plans/_test-utils/plan-library";
import { createGoalPlan } from "../plans/create-goal-plan";
import { getTodayStudySession } from "./_test-utils/open-today";

vi.mock("../users/get-session", () => ({ getSession: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));

const NOW = new Date("2026-09-30T12:00:00Z");

/** A learner whose plan studies two subjects, planned and signed in, before Today opens. */
async function setup() {
  const user = await userFixture();

  const library = await planLibraryFixture({
    skills: [
      { area: "Ciências da Natureza", lessons: 4 },
      { area: "Matemática", lessons: 4 },
    ],
  });

  const { goal } = await unplannedGoalFixture({
    dailyMinutes: 60,
    settings: { startDate: "2026-09-30" },
    timezone: "UTC",
    userId: user.id,
  });

  await Promise.all([
    createGoalPlan({ goalId: goal.id, graph: library.graph }),
    learningProfileFixture({ activeGoalId: goal.id, userId: user.id }),
  ]);

  mockSession(user.id);
  return { goal, library };
}

/** The lessons of the plan's items for a skill. */
async function loadItemLessonIds({ goalId, skillId }: { goalId: string; skillId?: string }) {
  const items = await prisma.planItem.findMany({
    select: { lessonId: true },
    where: { kind: "lesson", plan: { goalId }, skillId },
  });

  return items.flatMap((item) => item.lessonId ?? []);
}

/** Gives lessons one skill of their own that the goal's graph doesn't have. */
async function teachSkillOutsideGraph(lessonIds: string[]) {
  const outside = await skillFixture({ name: "A skill outside the graph" });

  await prisma.lessonSkill.updateMany({
    data: { skillId: outside.id },
    where: { lessonId: { in: lessonIds } },
  });
}

async function openToday(goalId: string) {
  const result = await getTodayStudySession({ goalId });

  if (result.status !== "ready") {
    throw new Error(`Expected a session, got ${result.status}`);
  }

  return result.session.blocks;
}

describe("a lesson's subject on today's list", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("is the subject of the lesson's own skills when they all sit in another subject than its plan item's", async () => {
    const { goal, library } = await setup();
    const [physics, math] = library.skills;

    // A chapter tagged with a physics skill and a math one holds a probability lesson; the plan
    // files it under the physics skill (Ana's "Espaço amostral em duas etapas" read Natural
    // Sciences).
    const lessonIds = await loadItemLessonIds({ goalId: goal.id, skillId: physics?.id });

    await prisma.lessonSkill.updateMany({
      data: { skillId: math?.id },
      where: { lessonId: { in: lessonIds } },
    });

    const blocks = await openToday(goal.id);
    const moved = blocks.filter((block) => block.lessonId && lessonIds.includes(block.lessonId));

    expect(moved.length).toBeGreaterThan(0);
    expect(moved.map((block) => block.subject)).toStrictEqual(moved.map(() => "Matemática"));
  });

  it("stays its plan item's subject when the lesson's own skills include it", async () => {
    const { goal, library } = await setup();
    const [physics, math] = library.skills;

    const lessonIds = await loadItemLessonIds({ goalId: goal.id, skillId: physics?.id });

    // The lessons teach their own physics skill and a math one too.
    await prisma.lessonSkill.createMany({
      data: lessonIds.map((lessonId) => ({ lessonId, skillId: math?.id ?? "" })),
    });

    const blocks = await openToday(goal.id);
    const kept = blocks.filter((block) => block.lessonId && lessonIds.includes(block.lessonId));

    expect(kept.length).toBeGreaterThan(0);

    expect(kept.map((block) => block.subject)).toStrictEqual(
      kept.map(() => "Ciências da Natureza"),
    );
  });

  it("is none when the lesson's own skills don't settle it and its chapter is tagged with several subjects", async () => {
    const { goal, library } = await setup();
    const [physics, math] = library.skills;
    const [chapter] = library.chapters;
    const lessonIds = await loadItemLessonIds({ goalId: goal.id, skillId: physics?.id });

    // Ana's "Ideia central em textos multimodais": its own skill isn't in her graph, and its chapter
    // was tagged with skills of three subjects; the plan filed it under the math one.
    await Promise.all([
      teachSkillOutsideGraph(lessonIds),
      chapterSkillFixture({ chapterId: chapter?.id ?? "", skillId: physics?.id ?? "" }),
      chapterSkillFixture({ chapterId: chapter?.id ?? "", skillId: math?.id ?? "" }),
    ]);

    const blocks = await openToday(goal.id);
    const rows = blocks.filter((block) => block.lessonId && lessonIds.includes(block.lessonId));

    expect(rows.length).toBeGreaterThan(0);
    expect(rows.map((block) => block.subject)).toStrictEqual(rows.map(() => null));
  });

  it("stays its plan item's subject when the lesson's own skills don't settle it and its chapter is one subject's", async () => {
    const { goal, library } = await setup();
    const [physics] = library.skills;
    const [chapter] = library.chapters;
    const lessonIds = await loadItemLessonIds({ goalId: goal.id, skillId: physics?.id });

    await Promise.all([
      teachSkillOutsideGraph(lessonIds),
      chapterSkillFixture({ chapterId: chapter?.id ?? "", skillId: physics?.id ?? "" }),
    ]);

    const blocks = await openToday(goal.id);
    const kept = blocks.filter((block) => block.lessonId && lessonIds.includes(block.lessonId));

    expect(kept.length).toBeGreaterThan(0);

    expect(kept.map((block) => block.subject)).toStrictEqual(
      kept.map(() => "Ciências da Natureza"),
    );
  });
});
