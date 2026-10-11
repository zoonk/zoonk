import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { goalFixture, planFixture } from "@zoonk/testing/fixtures/goals";
import { choiceItemContent, itemFixture, skillFixture } from "@zoonk/testing/fixtures/skills";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { discountMath, discountQuestion } from "../library/items/_test-utils/math-problems";
import { pickExamFormatSkills } from "./exam-format-skills";

const citation = { passage: "…", sourceId: "notice" };

const INTEGER = { kind: "integer", places: null } as const;

/** JEE Advanced's formats: one right option, one or more right options, and integer answers. */
const JEE_FORMATS = [
  { citation, description: "One correct option.", kind: "multipleChoice", options: 4 },
  {
    citation,
    description: "One or more correct options.",
    kind: "multipleChoice",
    options: 4,
    select: "all",
  },
  { citation, description: "Integer answer.", entry: INTEGER, kind: "numeric", options: null },
] as const;

const MATH_CONTENT = {
  context: null,
  math: discountMath,
  otherSolutions: [],
  question: discountQuestion,
};

/** An exam goal on JEE's formats with four first-phase skills (weights 1, 5, 3, 2) and one later. */
async function jeeGoal() {
  const [user, blueprint, skills] = await Promise.all([
    userFixture(),
    examBlueprintFixture({
      identityKey: `exam-${randomUUID()}`,
      name: "JEE Advanced",
      structure: { formats: [...JEE_FORMATS], mock: null, rules: [], subjects: [] },
    }),
    Promise.all([1, 2, 3, 4, 5].map((index) => skillFixture({ name: `Unit ${index}` }))),
  ]);

  const goal = await goalFixture({ examBlueprintId: blueprint.id, kind: "exam", userId: user.id });
  const weights = [1, 5, 3, 2, 5];

  await planFixture({
    goalId: goal.id,
    graph: {
      phases: [
        { milestone: null, name: "Foundations" },
        { milestone: null, name: "Exam practice" },
      ],
      skills: skills.map((skill, index) => ({
        area: null,
        lessons: 1,
        name: skill.name,
        phase: index < 4 ? 0 : 1,
        skillId: skill.id,
        weight: weights[index] ?? null,
      })),
    },
  });

  return { blueprint, goal, skills };
}

describe(pickExamFormatSkills, () => {
  it("picks first-phase skills by weight, skipping written ones", async () => {
    const { blueprint, goal, skills } = await jeeGoal();
    const [first, second, third, fourth] = skills;

    await Promise.all([
      // The second skill has the exam's one-pick questions, never its several-picks ones.
      itemFixture({
        content: choiceItemContent(),
        examBlueprintId: blueprint.id,
        skillId: second?.id ?? "",
      }),
      // The first skill has its several-picks questions already.
      itemFixture({
        content: { ...choiceItemContent(), select: "all" },
        examBlueprintId: blueprint.id,
        skillId: first?.id ?? "",
      }),
    ]);

    const picks = await pickExamFormatSkills({ goalId: goal.id });

    expect(
      picks
        .filter((pick) => pick.answerFormat.format === "multipleChoice")
        .map((pick) => [pick.skill.id, pick.skill.exam?.blueprintId]),
    ).toStrictEqual([
      [second?.id, blueprint.id],
      [third?.id, blueprint.id],
      [fourth?.id, blueprint.id],
    ]);
  });

  it("asks for numbers on skills known to take them first, then untried ones, never ones found to take none", async () => {
    const { blueprint, goal, skills } = await jeeGoal();
    const [first, second, third, fourth] = skills;

    await Promise.all([
      // The item writer found no problem with one number for its answer in the second skill.
      prisma.skill.update({ data: { isQuantitative: false }, where: { id: second?.id } }),
      // The first skill has a lesson's math problem; the fourth has the exam's own already.
      itemFixture({ content: MATH_CONTENT, format: "numeric", skillId: first?.id ?? "" }),
      itemFixture({
        content: { ...MATH_CONTENT, entry: INTEGER },
        examBlueprintId: blueprint.id,
        format: "numeric",
        skillId: fourth?.id ?? "",
      }),
    ]);

    const picks = await pickExamFormatSkills({ goalId: goal.id });

    expect(
      picks.filter((pick) => pick.answerFormat.format === "numeric").map((pick) => pick.skill.id),
    ).toStrictEqual([first?.id, third?.id]);
  });

  it("picks nothing for an exam asked in quick picks only", async () => {
    const [user, blueprint] = await Promise.all([
      userFixture(),
      examBlueprintFixture({
        identityKey: `exam-${randomUUID()}`,
        structure: { formats: [JEE_FORMATS[0]], mock: null, rules: [], subjects: [] },
      }),
    ]);

    const goal = await goalFixture({
      examBlueprintId: blueprint.id,
      kind: "exam",
      userId: user.id,
    });

    await expect(pickExamFormatSkills({ goalId: goal.id })).resolves.toStrictEqual([]);
  });
});
