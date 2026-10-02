import { randomUUID } from "node:crypto";
import { getBaseURL } from "@zoonk/e2e/fixtures/base-url";
import { createE2EUser } from "@zoonk/e2e/fixtures/users";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { libraryChapterFixture } from "@zoonk/testing/fixtures/library-chapters";
import {
  chapterLessonFixture,
  lessonSkillFixture,
  libraryLessonFixture,
} from "@zoonk/testing/fixtures/library-lessons";
import { choiceItemContent, itemFixture, skillFixture } from "@zoonk/testing/fixtures/skills";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { MS_PER_DAY, toUTCMidnight } from "@zoonk/utils/date";
import { type Mode } from "./learn-personas";

export const DAYS_TO_TEST = 3;
const LESSONS_PER_SKILL = 3;
const ITEMS_PER_SKILL = 3;

/** A teacher's test read from the learner's slides: a private blueprint that gives no length. */
const CLASS_TEST_STRUCTURE = { formats: [], mock: null, rules: [], subjects: [] };

/** The exam map from last year's test: how often each topic came up. */
const TOPICS = [
  { name: "Enzymes", weight: 4 },
  { name: "Glycolysis", weight: 3 },
  { name: "Krebs cycle", weight: 2 },
] as const;

/** A learner-local day from today, as the planner dates it (UTC midnight, the goal's zone). */
export function dayFromToday(offset: number): Date {
  return new Date(toUTCMidnight(new Date()).getTime() + offset * MS_PER_DAY);
}

async function createTopic({ name, weight }: { name: string; weight: number }) {
  const [chapter, skill] = await Promise.all([
    libraryChapterFixture({ title: name }),
    skillFixture({ name: `${name} ${randomUUID()}` }),
  ]);

  const lessons = await Promise.all(
    Array.from({ length: LESSONS_PER_SKILL }, (_, index) =>
      libraryLessonFixture({
        estimatedMinutes: 3,
        homeChapterId: chapter.id,
        title: `${name} ${index + 1}`,
      }),
    ),
  );

  await Promise.all([
    ...lessons.flatMap((lesson, position) => [
      chapterLessonFixture({ chapterId: chapter.id, lessonId: lesson.id, position }),
      lessonSkillFixture({ lessonId: lesson.id, skillId: skill.id }),
    ]),
    ...Array.from({ length: ITEMS_PER_SKILL }, () =>
      itemFixture({ content: choiceItemContent(), skillId: skill.id }),
    ),
  ]);

  return {
    area: "Biochemistry",
    lessons: LESSONS_PER_SKILL,
    name: skill.name,
    phase: 0,
    skillId: skill.id,
    weight,
  };
}

/**
 * Bia's biochemistry test days away (three by default), read from her slides (a private blueprint), with the
 * skill graph the goal-driven workflow writes. Placement settled glycolysis, so the plan starts
 * with what she doesn't know yet. The plan itself is built by the real planner the first time
 * Today opens. She has Plus, so the short mock is part of her plan.
 */
export async function createClassTestDays(mode: Mode, { days = DAYS_TO_TEST } = {}) {
  const user = await createE2EUser(getBaseURL(), { withSubscription: true });

  const [blueprint, skills] = await Promise.all([
    examBlueprintFixture({
      name: "Biochemistry test",
      ownerId: user.id,
      structure: CLASS_TEST_STRUCTURE,
      visibility: "private",
    }),
    Promise.all(TOPICS.map((topic) => createTopic(topic))),
  ]);

  const goal = await goalFixture({
    dailyMinutes: 30,
    details: { placementDeclined: true },
    examBlueprintId: blueprint.id,
    kind: "exam",
    targetDate: dayFromToday(days),
    timezone: "UTC",
    title: "Biochemistry test",
    userId: user.id,
  });

  const plan = await planFixture({
    goalId: goal.id,
    graph: { phases: [{ milestone: null, name: "Biochemistry" }], skills },
    phases: [],
  });

  const settled = skills[1];

  await Promise.all([
    planItemFixture({
      completedAt: new Date(),
      kind: "lesson",
      planId: plan.id,
      position: 0,
      skillId: settled?.skillId ?? null,
      status: "testedOut",
      titleSnapshot: "Biochemistry",
    }),
    learningProfileFixture({
      activeGoalId: goal.id,
      experienceMode: mode,
      userId: user.id,
      ...(mode === "fun" ? { buddyKind: "zu" } : {}),
    }),
  ]);

  return { user };
}
