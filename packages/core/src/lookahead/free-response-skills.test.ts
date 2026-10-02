import { goalFixture, planFixture } from "@zoonk/testing/fixtures/goals";
import { itemFixture, skillFixture } from "@zoonk/testing/fixtures/skills";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { pickFreeResponseSkills } from "./free-response-skills";

const ESSAY_CONTENT = {
  context: null,
  keyPoints: ["Explains the cause"],
  question: "Explain one cause of the change.",
  rubric: [
    { criterion: "Claim", description: "Makes a claim", points: 1 },
    { criterion: "Reasoning", description: "Explains it", points: 2 },
  ],
  sampleOutline: "Claim and reasoning.",
};

/** An exam goal with four skills: three in its first phase (weights 1, 5, 3) and one later. */
async function examGoal({ name }: { name: string }) {
  const [user, blueprint, skills] = await Promise.all([
    userFixture(),
    examBlueprintFixture({ identityKey: `exam-${crypto.randomUUID()}`, name }),
    Promise.all([1, 2, 3, 4].map((index) => skillFixture({ name: `Unit ${index}` }))),
  ]);

  const goal = await goalFixture({ examBlueprintId: blueprint.id, kind: "exam", userId: user.id });
  const weights = [1, 5, 3, 5];

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
        phase: index < 3 ? 0 : 1,
        skillId: skill.id,
        weight: weights[index] ?? null,
      })),
    },
  });

  return { blueprint, goal, skills };
}

describe(pickFreeResponseSkills, () => {
  it("picks an AP goal's first-phase skills, most weighted first, skipping written ones", async () => {
    const { blueprint, goal, skills } = await examGoal({ name: "AP World History: Modern" });

    await itemFixture({
      content: ESSAY_CONTENT,
      examBlueprintId: blueprint.id,
      format: "essay",
      skillId: skills[2]?.id ?? "",
    });

    const picked = await pickFreeResponseSkills({ goalId: goal.id });

    expect(picked.map((skill) => skill.id)).toStrictEqual([skills[1]?.id, skills[0]?.id]);
    expect(picked[0]?.exam).toMatchObject({ blueprintId: blueprint.id });
  });

  it("picks nothing for other exams", async () => {
    const { goal } = await examGoal({ name: "Concurso TJ-AP 2026" });

    await expect(pickFreeResponseSkills({ goalId: goal.id })).resolves.toStrictEqual([]);
  });
});
