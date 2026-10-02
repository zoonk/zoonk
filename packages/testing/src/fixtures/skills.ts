import { randomUUID } from "node:crypto";
import { type Item, type Skill, type SkillPrerequisite, prisma } from "@zoonk/db";
import { normalizeString } from "@zoonk/utils/string";
import { type FixtureAttrs, fixtureProvenance } from "./_utils/fixture-attrs";

/** Creates a Library skill with a unique identity key. */
export async function skillFixture(attrs?: FixtureAttrs<Skill>) {
  const name = attrs?.name ?? `Test skill ${randomUUID()}`;

  return prisma.skill.create({
    data: {
      description: "Test skill idea in one sentence",
      identityKey: `test-skill-${randomUUID()}`,
      language: "en",
      name,
      normalizedName: normalizeString(name),
      ...fixtureProvenance(),
      ...attrs,
    },
  });
}

/** Records that `prerequisiteId` is learned before `skillId`. */
export async function skillPrerequisiteFixture(
  attrs: Pick<SkillPrerequisite, "prerequisiteId" | "skillId">,
) {
  return prisma.skillPrerequisite.create({ data: attrs });
}

/**
 * A multiple-choice question the item bank accepts: the right option first, so a test answers
 * right or wrong on purpose, and a misconception and reason on the wrong one.
 */
export function choiceItemContent(question = `Test question ${randomUUID()}?`) {
  return {
    context: null,
    options: [
      {
        isCorrect: true,
        misconception: null,
        reason: "It follows the rule.",
        text: "Right answer",
      },
      {
        isCorrect: false,
        misconception: "Applies the rule backwards",
        reason: "You applied the rule backwards.",
        text: "Wrong answer",
      },
    ],
    question,
  };
}

/** Creates a multiple-choice item for a skill. */
export async function itemFixture(attrs: FixtureAttrs<Item, "content"> & Pick<Item, "skillId">) {
  return prisma.item.create({
    data: {
      content: {
        options: [
          { isCorrect: true, text: "Right answer" },
          { isCorrect: false, reason: "Test misconception", text: "Wrong answer" },
        ],
        question: "Test question?",
      },
      format: "multipleChoice",
      language: "en",
      ...fixtureProvenance(),
      ...attrs,
    },
  });
}
