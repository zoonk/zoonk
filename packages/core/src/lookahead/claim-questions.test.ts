import { goalFixture, planFixture } from "@zoonk/testing/fixtures/goals";
import { attemptFixture } from "@zoonk/testing/fixtures/learner";
import { choiceItemContent, itemFixture, skillFixture } from "@zoonk/testing/fixtures/skills";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { requestClaimQuestions } from "./claim-questions";

async function setup() {
  const user = await userFixture();

  const [goal, nucleus, virus, osmosis] = await Promise.all([
    goalFixture({ userId: user.id }),
    skillFixture({ name: "Núcleo" }),
    skillFixture({ name: "Vírus" }),
    skillFixture({ name: "Osmose" }),
  ]);

  await planFixture({
    goalId: goal.id,
    graph: {
      phases: [{ milestone: null, name: "A célula" }],
      skills: [nucleus, virus, osmosis].map((skill) => ({
        area: "Biologia",
        lessons: 2,
        name: skill.name,
        phase: 0,
        skillId: skill.id,
        weight: null,
      })),
    },
  });

  const [nucleusItem, virusItem] = await Promise.all([
    itemFixture({ content: choiceItemContent(), skillId: nucleus.id }),
    itemFixture({ content: choiceItemContent(), skillId: virus.id }),
    itemFixture({ content: choiceItemContent(), skillId: virus.id }),
    itemFixture({ content: choiceItemContent(), skillId: osmosis.id }),
  ]);

  await Promise.all([
    attemptFixture({ itemId: nucleusItem.id, skillId: nucleus.id, userId: user.id }),
    attemptFixture({ itemId: virusItem.id, skillId: virus.id, userId: user.id }),
  ]);

  return { goal, nucleus, user };
}

describe(requestClaimQuestions, () => {
  it("requires the goal's learner", async () => {
    const { goal } = await setup();

    mockSession(null);

    await expect(requestClaimQuestions({ goalId: goal.id })).resolves.toStrictEqual({
      status: "unauthorized",
    });

    const other = await userFixture();
    mockSession(other.id);

    await expect(requestClaimQuestions({ goalId: goal.id })).resolves.toStrictEqual({
      status: "notFound",
    });
  });

  it("asks for a few questions only for a topic to confirm that practice has none left to ask", async () => {
    const { goal, nucleus, user } = await setup();
    mockSession(user.id);

    await expect(requestClaimQuestions({ goalId: goal.id })).resolves.toMatchObject({
      analytics: { distinctId: user.id, goalId: goal.id },
      format: "multipleChoice",
      questionsPerSkill: 3,
      skillIds: [nucleus.id],
      status: "start",
    });

    await itemFixture({ content: choiceItemContent(), skillId: nucleus.id });

    await expect(requestClaimQuestions({ goalId: goal.id })).resolves.toStrictEqual({
      status: "ready",
    });
  });
});
