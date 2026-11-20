import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { goalFixture, planFixture } from "@zoonk/testing/fixtures/goals";
import { choiceItemContent, itemFixture, skillFixture } from "@zoonk/testing/fixtures/skills";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { getItemAudienceFilter } from "../library/items/item-field";
import { pickExamFormatSkills } from "./exam-format-skills";

const citation = { passage: "…", sourceId: "notice" };

const FORMATS = [
  { citation, description: "One correct option.", kind: "multipleChoice", options: 4 },
  {
    citation,
    description: "One or more correct options.",
    kind: "multipleChoice",
    options: 4,
    select: "all",
  },
] as const;

async function examGoal() {
  const [user, blueprint, skill] = await Promise.all([
    userFixture(),
    examBlueprintFixture({
      identityKey: `exam-${randomUUID()}`,
      name: "JEE Advanced",
      structure: { formats: [...FORMATS], mock: null, rules: [], subjects: [] },
    }),
    skillFixture({ name: "Unit 1" }),
  ]);

  const goal = await goalFixture({ examBlueprintId: blueprint.id, kind: "exam", userId: user.id });

  await planFixture({
    goalId: goal.id,
    graph: {
      phases: [{ milestone: null, name: "Foundations" }],
      skills: [
        { area: null, lessons: 1, name: skill.name, phase: 0, skillId: skill.id, weight: 1 },
      ],
    },
  });

  return { blueprint, goal, skill, user };
}

describe("the mock reserve and exam-format practice", () => {
  it("a skill with no select-all question is picked for practice writing", async () => {
    const { goal, skill } = await examGoal();
    const picks = await pickExamFormatSkills({ goalId: goal.id });
    expect(picks.map((pick) => pick.skill.id)).toStrictEqual([skill.id]);
  });

  it("a reserve-only select-all question should not count as the skill's practice", async () => {
    const { blueprint, goal, skill, user } = await examGoal();

    await itemFixture({
      content: { ...choiceItemContent(), select: "all" },
      examBlueprintId: blueprint.id,
      mockOnly: true,
      skillId: skill.id,
    });

    const servable = await prisma.item.count({
      where: {
        skillId: skill.id,
        ...getItemAudienceFilter({ examBlueprintId: blueprint.id, userId: user.id }),
      },
    });

    expect(servable).toBe(0);

    const picks = await pickExamFormatSkills({ goalId: goal.id });
    expect(picks.map((pick) => pick.skill.id)).toStrictEqual([skill.id]);
  });
});
