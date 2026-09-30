import { prisma } from "@zoonk/db";
import { expect, test } from "@zoonk/e2e/fixtures";
import { goalFixture, planFixture } from "@zoonk/testing/fixtures/goals";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { libraryChapterFixture } from "@zoonk/testing/fixtures/library-chapters";
import {
  chapterLessonFixture,
  lessonSkillFixture,
  libraryLessonFixture,
} from "@zoonk/testing/fixtures/library-lessons";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { planChangeResultSchema, planResponseSchema } from "../src/lib/openapi/schemas/plans";
import { todayResponseSchema } from "../src/lib/openapi/schemas/today";
import { createBearerLearner } from "./helpers/bearer";

const DAY_MS = 86_400_000;
const DAYS_TO_TEST = 3;
const LESSONS = 6;
const EVERY_WEEKDAY = [0, 1, 2, 3, 4, 5, 6];

/** A teacher's test read from the learner's slides: a private blueprint that gives no length. */
const CLASS_TEST_STRUCTURE = { formats: [], mock: null, rules: [], subjects: [] };

function isoDay(offset: number): string {
  const today = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`);
  return new Date(today.getTime() + offset * DAY_MS).toISOString().slice(0, 10);
}

/**
 * A class test three days away, read from the learner's own slides, with the skill graph the
 * goal-driven workflow writes and a chapter of short lessons for its one skill.
 */
async function createClassTest(userId: string) {
  const [blueprint, chapter, skill] = await Promise.all([
    examBlueprintFixture({
      name: "Biochemistry test",
      ownerId: userId,
      structure: CLASS_TEST_STRUCTURE,
      visibility: "private",
    }),
    libraryChapterFixture({ title: "Enzymes" }),
    skillFixture({ name: "Explain how enzymes work" }),
  ]);

  const lessons = await Promise.all(
    Array.from({ length: LESSONS }, (_, index) =>
      libraryLessonFixture({
        estimatedMinutes: 3,
        homeChapterId: chapter.id,
        title: `Enzymes ${index + 1}`,
      }),
    ),
  );

  await Promise.all(
    lessons.flatMap((lesson, position) => [
      chapterLessonFixture({ chapterId: chapter.id, lessonId: lesson.id, position }),
      lessonSkillFixture({ lessonId: lesson.id, skillId: skill.id }),
    ]),
  );

  const goal = await goalFixture({
    dailyMinutes: 30,
    details: { placementDeclined: true },
    examBlueprintId: blueprint.id,
    kind: "exam",
    targetDate: new Date(`${isoDay(DAYS_TO_TEST)}T00:00:00Z`),
    timezone: "UTC",
    title: "Biochemistry test",
    userId,
  });

  await Promise.all([
    planFixture({
      goalId: goal.id,
      graph: {
        phases: [{ milestone: null, name: "Biochemistry" }],
        skills: [
          {
            area: "Biochemistry",
            lessons: LESSONS,
            name: skill.name,
            phase: 0,
            skillId: skill.id,
            weight: 4,
          },
        ],
      },
      phases: [],
    }),
    learningProfileFixture({ activeGoalId: goal.id, userId }),
  ]);

  return { goal };
}

test.describe("Plans for a test days away", () => {
  let baseURL: string;

  test.beforeAll(() => {
    baseURL = process.env.E2E_BASE_URL ?? "";
  });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  test("plans a class test day by day, with its short mock the day before", async () => {
    const { api, userId } = await createBearerLearner({ baseURL, prefix: "short-exam" });
    const { goal } = await createClassTest(userId);

    const changed = await api.post(`/v1/goals/${goal.id}/plan/changes`, {
      data: { operations: [{ kind: "setWeekdayMinutes", minutes: 30, weekdays: EVERY_WEEKDAY }] },
    });

    expect(changed.status(), await changed.text()).toBe(200);
    expect(planChangeResultSchema.parse(await changed.json())).toMatchObject({ status: "applied" });

    const planResponse = await api.get(`/v1/goals/${goal.id}/plan`);
    expect(planResponse.status()).toBe(200);
    const plan = planResponseSchema.parse(await planResponse.json());

    expect(plan.shortPlan).toStrictEqual({ days: DAYS_TO_TEST, mockDate: isoDay(2) });

    expect(plan.phases.map((phase) => phase.short)).toStrictEqual([
      { firstDay: 1, focus: "mapAndGaps", lastDay: 1 },
      { firstDay: 2, focus: "practice", lastDay: 2 },
      { firstDay: 3, focus: "mockAndReview", lastDay: 3 },
    ]);

    const todayResponse = await api.get(`/v1/today?timeZone=UTC&goalId=${goal.id}`);
    expect(todayResponse.status(), await todayResponse.text()).toBe(200);
    const today = todayResponseSchema.parse(await todayResponse.json());

    expect(today.shortPlan).toStrictEqual({
      day: 1,
      days: DAYS_TO_TEST,
      focus: "mapAndGaps",
      mockDate: isoDay(2),
    });

    expect(today.session.blocks.map((block) => block.kind)).toContain("learn");

    await api.dispose();
  });
});
