import { prisma } from "@zoonk/db";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import {
  chapterLessonFixture,
  lessonSkillFixture,
  libraryLessonFixture,
} from "@zoonk/testing/fixtures/library-lessons";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { replanGoalsWaitingOnSkills } from "../library/curriculum/replan-waiting-goals";
import { planLibraryFixture, unplannedGoalFixture } from "../plans/_test-utils/plan-library";
import { changeGoalPlan } from "../plans/change-goal-plan";
import { createGoalPlan } from "../plans/create-goal-plan";
import { getTodayStudySession } from "./get-today-study-session";
import { startStudyBlock } from "./start-study-block";

vi.mock("../users/get-session", () => ({ getSession: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));

const NOW = new Date("2026-09-30T12:00:00Z");
const A_MINUTE_LATER = new Date("2026-09-30T12:01:00Z");
const LESSONS_LANDING = 4;

async function readToday(goalId: string) {
  const result = await getTodayStudySession({ goalId, timeZone: "UTC" });

  if (result.status !== "ready") {
    throw new Error(`Expected a session, got ${result.status}`);
  }

  return result.session;
}

/**
 * A learner whose plan has one written skill and one still waiting for its lessons (a stand-in),
 * so today's first session is shorter than their day until the second skill's lessons land.
 */
async function setupWaitingSkill() {
  const user = await userFixture();

  const library = await planLibraryFixture({
    skills: [{ lessons: 2 }, { lessons: 0, size: LESSONS_LANDING }],
  });

  const { goal } = await unplannedGoalFixture({
    dailyMinutes: 30,
    settings: { startDate: "2026-09-30" },
    timezone: "UTC",
    userId: user.id,
  });

  await Promise.all([
    createGoalPlan({ goalId: goal.id, graph: library.graph }),
    learningProfileFixture({ activeGoalId: goal.id, userId: user.id }),
  ]);

  mockSession(user.id);

  return { goal, library, user };
}

/** The waiting skill's lessons land in the Library and the system re-plans the goals using it. */
async function landWaitingLessons(library: Awaited<ReturnType<typeof planLibraryFixture>>) {
  const [chapter] = library.chapters;
  const skillId = library.skills[1]?.id ?? "";

  await Promise.all(
    Array.from({ length: LESSONS_LANDING }, async (_, index) => {
      const lesson = await libraryLessonFixture({
        estimatedMinutes: 3,
        homeChapterId: chapter?.id ?? null,
        title: `Landed lesson ${index + 1} ${crypto.randomUUID()}`,
      });

      await Promise.all([
        chapterLessonFixture({
          chapterId: chapter?.id ?? "",
          lessonId: lesson.id,
          position: 100 + index,
        }),
        lessonSkillFixture({ lessonId: lesson.id, skillId }),
      ]);
    }),
  );

  await replanGoalsWaitingOnSkills({ skillIds: [skillId] });

  return skillId;
}

function learnBlocks(session: Awaited<ReturnType<typeof readToday>>) {
  return session.blocks.filter((block) => block.kind === "learn");
}

describe("today's session when the plan changes", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("takes lessons that landed while the learner hasn't started, keeping its id and what it offers next", async () => {
    const { goal, library } = await setupWaitingSkill();
    const before = await readToday(goal.id);

    vi.setSystemTime(A_MINUTE_LATER);
    await landWaitingLessons(library);

    const after = await readToday(goal.id);

    expect(after.id).toBe(before.id);
    expect(after.nextBlockId).toBe(before.nextBlockId);
    expect(learnBlocks(after).length).toBeGreaterThan(learnBlocks(before).length);
    expect(after.minutes.planned).toBeGreaterThan(before.minutes.planned);
  });

  it("only adds landed lessons at the end of a day the learner started", async () => {
    const { goal, library } = await setupWaitingSkill();
    const before = await readToday(goal.id);

    await startStudyBlock({
      blockId: before.nextBlockId ?? "",
      input: { timeZone: "UTC" },
      sessionId: before.id,
    });

    vi.setSystemTime(A_MINUTE_LATER);
    await landWaitingLessons(library);

    const after = await readToday(goal.id);
    const kept = after.blocks.slice(0, before.blocks.length);
    const added = after.blocks.slice(before.blocks.length);

    expect(after.id).toBe(before.id);
    expect(kept.map((block) => block.id)).toStrictEqual(before.blocks.map((block) => block.id));
    expect(added.length).toBeGreaterThan(0);
    expect(added.every((block) => block.kind === "learn")).toBe(true);
    expect(after.minutes.planned).toBeGreaterThan(before.minutes.planned);
  });

  it("follows the learner's own change in the part they haven't started, in place", async () => {
    const { goal } = await setupWaitingSkill();
    const before = await readToday(goal.id);
    const first = before.blocks[0];

    await startStudyBlock({
      blockId: first?.id ?? "",
      input: { timeZone: "UTC" },
      sessionId: before.id,
    });

    const changed = await changeGoalPlan({
      goalId: goal.id,
      input: { operations: [{ kind: "setDailyMinutes", minutes: 5 }], timeZone: "UTC" },
    });

    const after = await readToday(goal.id);

    expect(changed).toMatchObject({ change: { todaySession: "changed" }, status: "applied" });
    expect(after.id).toBe(before.id);
    expect(after.blocks[0]).toMatchObject({ id: first?.id, status: "active" });
    expect(after.minutes.planned).toBeLessThan(before.minutes.planned);

    await expect(prisma.studySession.count({ where: { goalId: goal.id } })).resolves.toBe(1);
  });

  // Marcos added field topics to a later part of his plan: the card said today's session followed
  // the change, though today stayed exactly as it was.
  it("says nothing about today's session when a change leaves it as it was", async () => {
    const { goal } = await setupWaitingSkill();
    const before = await readToday(goal.id);

    const changed = await changeGoalPlan({
      goalId: goal.id,
      input: { operations: [{ kind: "addLightWeek", startDate: "2026-10-19" }], timeZone: "UTC" },
    });

    const after = await readToday(goal.id);

    expect(changed).toMatchObject({ change: { todaySession: null }, status: "applied" });

    expect(after.blocks.map((block) => block.id)).toStrictEqual(
      before.blocks.map((block) => block.id),
    );
  });

  it("says a change starts on the next study day when today's session is done", async () => {
    const { goal } = await setupWaitingSkill();
    const today = await readToday(goal.id);

    await prisma.studySessionBlock.updateMany({
      data: { completedAt: NOW, startedAt: NOW, status: "completed" },
      where: { sessionId: today.id },
    });

    await prisma.studySession.update({
      data: { endedAt: NOW, startedAt: NOW, status: "completed" },
      where: { id: today.id },
    });

    const changed = await changeGoalPlan({
      goalId: goal.id,
      input: { operations: [{ kind: "setDailyMinutes", minutes: 5 }], timeZone: "UTC" },
    });

    expect(changed).toMatchObject({ change: { todaySession: "unchanged" }, status: "applied" });
  });
});
