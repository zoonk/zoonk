import { randomUUID } from "node:crypto";
import { type Item, type ItemSet, type Skill, type SkillPrerequisite, prisma } from "@zoonk/db";
import { normalizeString } from "@zoonk/utils/string";
import { type FixtureAttrs, fixtureProvenance } from "./_utils/fixture-attrs";

/** A skill row with a unique identity key and, unless given one, a unique name. */
function skillData(attrs?: FixtureAttrs<Skill>) {
  const name = attrs?.name ?? `Test skill ${randomUUID()}`;

  return {
    description: "Test skill idea in one sentence",
    identityKey: `test-skill-${randomUUID()}`,
    language: "en",
    name,
    normalizedName: normalizeString(name),
    ...fixtureProvenance(),
    ...attrs,
  };
}

/** Creates a Library skill with a unique identity key. */
export async function skillFixture(attrs?: FixtureAttrs<Skill>) {
  return prisma.skill.create({ data: skillData(attrs) });
}

/** One skill like `skillFixture`'s for each name, in one statement. */
export async function skillsFixture(
  names: readonly string[],
  attrs?: Omit<FixtureAttrs<Skill>, "identityKey" | "name" | "normalizedName">,
) {
  return prisma.skill.createManyAndReturn({
    data: names.map((name) => skillData({ ...attrs, name })),
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

/** A passage several questions read (`ItemSet.content` of kind `text`), unique per call. */
export function textSetContent(title = `Test passage ${randomUUID()}`) {
  return {
    source: "Adapted from a test article.",
    text: "The town's library opened on Sundays last year. Visits rose by a third, mostly families.",
    title,
  };
}

/** Creates an item set: a passage, unless another kind and content are given. */
export async function itemSetFixture(attrs?: FixtureAttrs<ItemSet, "content">) {
  return prisma.itemSet.create({
    data: {
      content: textSetContent(),
      kind: "text",
      language: "en",
      ...fixtureProvenance(),
      ...attrs,
    },
  });
}
