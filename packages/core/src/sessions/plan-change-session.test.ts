import { prisma } from "@zoonk/db";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { choiceItemContent, itemFixture, skillFixture } from "@zoonk/testing/fixtures/skills";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { getChapterTestOut } from "../learner/test-out/get-chapter-test-out";
import { submitChapterTestOut } from "../learner/test-out/submit-chapter-test-out";
import { planLibraryFixture, unplannedGoalFixture } from "../plans/_test-utils/plan-library";
import { changeGoalPlan } from "../plans/change-goal-plan";
import { createGoalPlan } from "../plans/create-goal-plan";
import { getTodayStudySession } from "./get-today-study-session";

vi.mock("../users/get-session", () => ({ getSession: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));

const NOW = new Date("2026-09-30T12:00:00Z");

async function todayMinutes(goalId: string) {
  const result = await getTodayStudySession({ goalId });

  if (result.status !== "ready") {
    throw new Error(`Expected a session, got ${result.status}`);
  }

  return { id: result.session.id, minutes: result.session.minutes.planned };
}

describe("today's session after a plan change", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("takes the new daily time in place when the learner hasn't started it", async () => {
    const user = await userFixture();
    const library = await planLibraryFixture({ skills: [{ lessons: 40 }] });

    const { goal } = await unplannedGoalFixture({
      dailyMinutes: 15,
      settings: { startDate: "2026-09-30" },
      timezone: "UTC",
      userId: user.id,
    });

    await Promise.all([
      createGoalPlan({ goalId: goal.id, graph: library.graph }),
      learningProfileFixture({ activeGoalId: goal.id, userId: user.id }),
    ]);

    mockSession(user.id);

    const before = await todayMinutes(goal.id);

    await changeGoalPlan({
      goalId: goal.id,
      input: { operations: [{ kind: "setDailyMinutes", minutes: 60 }], timeZone: "UTC" },
    });

    const after = await todayMinutes(goal.id);

    expect(after.id).toBe(before.id);
    expect(after.minutes).toBeGreaterThan(before.minutes);
    await expect(prisma.studySession.count({ where: { goalId: goal.id } })).resolves.toBe(1);
  });

  it("keeps a lesson's subject on today's list after a re-plan removes its plan item", async () => {
    const user = await userFixture();

    const library = await planLibraryFixture({
      skills: [
        { area: "Língua Inglesa", lessons: 6 },
        { area: "Informática", lessons: 6 },
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

    // A lesson teaches skills finer than the plan's, which have no subject of their own.
    const finer = await skillFixture({ name: "A finer skill of the lesson" });

    await prisma.lessonSkill.updateMany({
      data: { skillId: finer.id },
      where: { lessonId: { in: library.lessons.map((lesson) => lesson.id) } },
    });

    mockSession(user.id);

    const before = await getTodayStudySession({ goalId: goal.id });
    const learn = before.status === "ready" ? before.session.blocks.find((b) => b.lessonId) : null;

    expect(learn?.subject).toBeTruthy();

    // The learner started the lesson; a change (a subject starting past its basics) re-planned
    // its item away while the lesson stays on today's list.
    const block = await prisma.studySessionBlock.findUniqueOrThrow({ where: { id: learn?.id } });
    const { planItemId } = block.payload as { planItemId: string };
    await prisma.studySessionBlock.update({ data: { status: "active" }, where: { id: block.id } });
    await prisma.planItem.delete({ where: { id: planItemId } });

    const after = await getTodayStudySession({ goalId: goal.id });

    const kept =
      after.status === "ready" ? after.session.blocks.find((b) => b.id === block.id) : null;

    expect(kept?.subject).toBe(learn?.subject);
  });

  it("drops a chapter the learner tested out of from the part of today not started", async () => {
    const user = await userFixture();

    const library = await planLibraryFixture({
      phases: ["Basics", "More"],
      skills: [
        { lessons: 6, phase: 0 },
        { lessons: 6, phase: 1 },
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
      ...Array.from({ length: 4 }, () =>
        itemFixture({ content: choiceItemContent(), skillId: library.skills[0]?.id ?? "" }),
      ),
    ]);

    mockSession(user.id);

    const basics = new Set(library.lessons.slice(0, 6).map((lesson) => lesson.id));

    const todayLessons = async () => {
      const result = await getTodayStudySession({ goalId: goal.id });
      const blocks = result.status === "ready" ? result.session.blocks : [];
      return blocks.flatMap((block) => (block.lessonId ? [block.lessonId] : []));
    };

    const before = await todayLessons();
    expect(before.some((lessonId) => basics.has(lessonId))).toBe(true);

    const chapterId = library.chapters[0]?.id ?? "";
    const testOut = await getChapterTestOut({ chapterId, goalId: goal.id });
    const questions = testOut.status === "ready" ? testOut.testOut.questions : [];

    const result = await submitChapterTestOut({
      chapterId,
      goalId: goal.id,
      input: {
        answers: questions.map((question) => ({
          answer: { selectedIndex: 0 },
          durationMs: 5000,
          itemId: question.itemId,
        })),
        timeZone: "UTC",
      },
    });

    expect(result.status === "ready" && result.outcome.passed).toBe(true);

    const after = await todayLessons();
    expect(after.some((lessonId) => basics.has(lessonId))).toBe(false);
  });
});
