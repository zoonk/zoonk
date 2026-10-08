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
import { createGoalPlan } from "../plans/create-goal-plan";
import { getTodayStudySession } from "./get-today-study-session";

vi.mock("../users/get-session", () => ({ getSession: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));

const NOW = new Date("2026-09-30T12:00:00Z");
const A_MINUTE_LATER = new Date("2026-09-30T12:01:00Z");
const TODAY = new Date("2026-09-30T00:00:00Z");
const LANDING = 4;

type Library = Awaited<ReturnType<typeof planLibraryFixture>>;

async function readToday(goalId: string) {
  const result = await getTodayStudySession({ goalId, timeZone: "UTC" });

  if (result.status !== "ready") {
    throw new Error(`Expected a session, got ${result.status}`);
  }

  return result.session;
}

/**
 * A learner whose first day holds a skill the Library hasn't outlined yet (a stand-in) between a
 * written skill and one written for later, as Carla's and Lucas's first days did while their
 * courses were still being outlined.
 */
async function setupDayWithStandIn({ dailyMinutes = 45 }: { dailyMinutes?: number } = {}) {
  const user = await userFixture();

  const library = await planLibraryFixture({
    skills: [{ lessons: 2 }, { lessons: 0, size: LANDING }, { lessons: 8 }],
  });

  const { goal } = await unplannedGoalFixture({
    dailyMinutes,
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

/**
 * The waiting skill's lessons land in the Library (`count`, as many as its stand-in planned unless
 * the outline wrote more) and the system re-plans the goals using it.
 */
async function landWaitingLessons(library: Library, count = LANDING): Promise<string[]> {
  const [chapter] = library.chapters;
  const skillId = library.skills[1]?.id ?? "";

  const lessons = await Promise.all(
    Array.from({ length: count }, async (_, index) => {
      const lesson = await libraryLessonFixture({
        estimatedMinutes: 3,
        homeChapterId: chapter?.id ?? null,
        title: `Landed lesson ${index + 1} ${crypto.randomUUID()}`,
      });

      await Promise.all([
        chapterLessonFixture({
          chapterId: chapter?.id ?? "",
          lessonId: lesson.id,
          position: 150 + index,
        }),
        lessonSkillFixture({ lessonId: lesson.id, skillId }),
      ]);

      return lesson.id;
    }),
  );

  await replanGoalsWaitingOnSkills({ skillIds: [skillId] });

  return lessons;
}

function learnLessonIds(session: Awaited<ReturnType<typeof readToday>>): string[] {
  return session.blocks.flatMap((block) =>
    block.kind === "learn" && block.lessonId ? [block.lessonId] : [],
  );
}

describe("today's session the learner was shown", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // Lucas's Today listed Linguagens, Matemática, Redação and Estratégia; when lessons landed, the
  // day he hadn't started yet was rebuilt as Linguagens and Redação, with no plan change.
  it("keeps every block it showed, in order, when lessons the plan waited on land", async () => {
    const { goal, library } = await setupDayWithStandIn();
    const before = await readToday(goal.id);

    vi.setSystemTime(A_MINUTE_LATER);
    const landed = await landWaitingLessons(library);
    const after = await readToday(goal.id);

    expect(after.id).toBe(before.id);

    expect(after.blocks.slice(0, before.blocks.length).map((block) => block.id)).toStrictEqual(
      before.blocks.map((block) => block.id),
    );

    // The landed lessons take the time the day held for them, then the day fills as usual.
    const added = after.blocks.slice(before.blocks.length, before.blocks.length + landed.length);

    expect(added.map((block) => block.lessonId)).toStrictEqual(landed);
  });

  // Carla's Today said 7 lessons and her session opened with 15: the rest landed in between.
  it("says more lessons are on the way while the day holds their place, until they land", async () => {
    const { goal, library } = await setupDayWithStandIn();
    const before = await readToday(goal.id);

    expect(before.lessonsComing).toBe(true);

    await landWaitingLessons(library);
    const after = await readToday(goal.id);

    expect(after.lessonsComing).toBe(false);
  });

  it("keeps the place of lessons still being outlined instead of filling it with later ones", async () => {
    const { goal } = await setupDayWithStandIn();
    const before = await readToday(goal.id);

    const dueToday = await prisma.planItem.findMany({
      where: { lessonId: { not: null }, plan: { goalId: goal.id }, scheduledFor: { lte: TODAY } },
    });

    const due = new Set(dueToday.map((item) => item.lessonId));

    expect(learnLessonIds(before).length).toBeGreaterThan(0);
    expect(learnLessonIds(before).filter((id) => !due.has(id))).toStrictEqual([]);
  });

  // Lucas's landed lessons were planned on the day he had already been shown, beyond its time, so
  // the next day would have opened by "catching up" on lessons he never saw.
  it("plans what the shown day can't hold on later days, not as work the day left", async () => {
    const { goal, library } = await setupDayWithStandIn();
    await readToday(goal.id);
    await landWaitingLessons(library, LANDING * 3);
    const today = await readToday(goal.id);
    const held = new Set(learnLessonIds(today));

    const dueToday = await prisma.planItem.findMany({
      where: {
        kind: { in: ["lesson", "chapter"] },
        plan: { goalId: goal.id },
        scheduledFor: { lte: TODAY },
        status: "todo",
      },
    });

    expect(
      dueToday
        .filter((item) => !item.lessonId || !held.has(item.lessonId))
        .map((item) => item.titleSnapshot),
    ).toStrictEqual([]);
  });
});
