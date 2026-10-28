import { randomUUID } from "node:crypto";
import { type Item, type ItemSet, type Skill, type SkillPrerequisite, prisma } from "@zoonk/db";
import { isJsonObject } from "@zoonk/utils/json";
import { normalizeString } from "@zoonk/utils/string";
import { type FixtureAttrs, fixtureProvenance } from "./_utils/fixture-attrs";

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

export async function skillFixture(attrs?: FixtureAttrs<Skill>) {
  return prisma.skill.create({ data: skillData(attrs) });
}

export async function skillsFixture(
  names: readonly string[],
  attrs?: Omit<FixtureAttrs<Skill>, "identityKey" | "name" | "normalizedName">,
) {
  return prisma.skill.createManyAndReturn({
    data: names.map((name) => skillData({ ...attrs, name })),
  });
}

export async function skillPrerequisiteFixture(
  attrs: Pick<SkillPrerequisite, "prerequisiteId" | "skillId">,
) {
  return prisma.skillPrerequisite.create({ data: attrs });
}

/** The right option comes first, so a test can answer right or wrong on purpose. */
export function choiceItemContent(question = `Test question ${randomUUID()}?`) {
  return {
    context: null,
    fixedOrder: false,
    image: null,
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
    select: 1,
    visual: null,
  };
}

function completeItemContent(content: object, format: Item["format"]): object {
  if (!isJsonObject(content)) {
    return content;
  }

  if (format === "multipleChoice") {
    return { fixedOrder: false, image: null, select: 1, visual: null, ...content };
  }

  if (format === "trueFalse" || format === "typed") {
    return { image: null, visual: null, ...content };
  }

  if (format === "numeric") {
    return { entry: { kind: "number", places: null }, otherSolutions: [], ...content };
  }

  if (format === "essay" && Array.isArray(content.rubric)) {
    return {
      ...content,
      rubric: content.rubric.map((row) => (isJsonObject(row) ? { points: null, ...row } : row)),
    };
  }

  return content;
}

export async function itemFixture(attrs: FixtureAttrs<Item, "content"> & Pick<Item, "skillId">) {
  const { content = choiceItemContent("Test question?"), format = "multipleChoice" } = attrs;

  return prisma.item.create({
    data: {
      language: "en",
      ...fixtureProvenance(),
      ...attrs,
      content: completeItemContent(content, format),
      format,
    },
  });
}

export function textSetContent(title = `Test passage ${randomUUID()}`) {
  return {
    source: "Adapted from a test article.",
    text: "The town's library opened on Sundays last year. Visits rose by a third, mostly families.",
    title,
  };
}

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
