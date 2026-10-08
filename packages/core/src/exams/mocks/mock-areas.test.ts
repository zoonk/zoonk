import { prisma } from "@zoonk/db";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { lessonSkillFixture, libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { choiceItemContent, itemFixture, skillFixture } from "@zoonk/testing/fixtures/skills";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { type ExamStructure } from "../../library/exams/blueprint-contract";
import { planWeeklyMock } from "./_utils/plan-weekly-mock";

const QUESTIONS_PER_SKILL = 4;

/** One exam day of two sections, each named after one of the plan's areas. */
const TWO_SECTIONS: ExamStructure = {
  formats: [],
  mock: {
    adaptive: false,
    citations: [],
    order: null,
    scoring: { description: "", method: "raw" },
    sections: [
      { day: null, minutes: 12, name: "Mathematics", questions: 8 },
      { day: null, minutes: 12, name: "Languages and Codes", questions: 8 },
    ],
    timeLimitMinutes: 24,
    totalQuestions: 16,
  },
  rules: [],
  subjects: [],
};

/** A skill of the plan's graph, in an area. */
function graphSkill(skillId: string, area: string) {
  return { area, lessons: 1, name: area, phase: 0, skillId, weight: null };
}

/**
 * A plan whose graph names the areas of its own skills, while the questions belong to the skills
 * its lessons teach (not in the graph): the lesson's plan item says which graph skill, so which
 * area, it teaches. A third skill no plan item teaches has no known area.
 */
async function areaSetup() {
  const user = await userFixture();
  const goal = await goalFixture({ timezone: "UTC", userId: user.id });

  const [mathGraph, languageGraph, mathTaught, languageTaught, stray] = await Promise.all(
    ["Math graph", "Language graph", "Fractions", "Reading", "Stray"].map((name) =>
      skillFixture({ name: `${name} ${crypto.randomUUID()}` }),
    ),
  );

  const plan = await planFixture({
    goalId: goal.id,
    graph: {
      phases: [{ milestone: null, name: "Basics" }],
      skills: [
        graphSkill(mathGraph?.id ?? "", "Math"),
        graphSkill(languageGraph?.id ?? "", "Languages"),
      ],
    },
  });

  const [mathLesson, languageLesson] = await Promise.all([
    libraryLessonFixture({ title: "Fractions" }),
    libraryLessonFixture({ title: "Reading" }),
  ]);

  const taught = [mathTaught, languageTaught, stray];

  await Promise.all([
    lessonSkillFixture({ lessonId: mathLesson.id, skillId: mathTaught?.id ?? "" }),
    lessonSkillFixture({ lessonId: languageLesson.id, skillId: languageTaught?.id ?? "" }),
    planItemFixture({
      lessonId: mathLesson.id,
      planId: plan.id,
      position: 0,
      skillId: mathGraph?.id ?? null,
    }),
    planItemFixture({
      lessonId: languageLesson.id,
      planId: plan.id,
      position: 1,
      skillId: languageGraph?.id ?? null,
    }),
    ...taught.flatMap((skill) =>
      Array.from({ length: QUESTIONS_PER_SKILL }, () =>
        itemFixture({ content: choiceItemContent(), skillId: skill?.id ?? "" }),
      ),
    ),
  ]);

  return { goal, skillIds: taught.map((skill) => skill?.id ?? ""), user };
}

describe("a mock's sections", () => {
  it("ask only their own area's questions, the areas of lesson skills included", async () => {
    const { goal, skillIds, user } = await areaSetup();

    const plan = await planWeeklyMock({
      goal,
      skillIds,
      structure: TWO_SECTIONS,
      today: new Date("2026-09-30T00:00:00Z"),
      userId: user.id,
    });

    const items = await prisma.item.findMany({ where: { skillId: { in: skillIds } } });
    const skillOf = new Map(items.map((item) => [item.id, item.skillId]));
    const [math, languages] = plan.sections;
    const [mathSkill, languageSkill] = skillIds;

    expect(plan.sections.map((section) => section.name)).toStrictEqual([
      "Mathematics",
      "Languages and Codes",
    ]);

    expect(math?.itemIds).toHaveLength(QUESTIONS_PER_SKILL);
    expect(languages?.itemIds).toHaveLength(QUESTIONS_PER_SKILL);
    expect(math?.itemIds.every((id) => skillOf.get(id) === mathSkill)).toBe(true);
    expect(languages?.itemIds.every((id) => skillOf.get(id) === languageSkill)).toBe(true);
  });
});
