import { goalFixture, planFixture } from "@zoonk/testing/fixtures/goals";
import { attemptFixture } from "@zoonk/testing/fixtures/learner";
import { choiceItemContent, itemFixture, skillFixture } from "@zoonk/testing/fixtures/skills";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { requestClaimQuestionsFor } from "./claim-questions";

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

  return { goal, nucleus, user, virus };
}

function orderTaps(skillId: string) {
  return Promise.all(
    ["Transcription", "Export", "Translation"].map((step) =>
      itemFixture({
        content: {
          question: `Order how a cell makes a protein (${step}).`,
          reason: "Each step needs the one before.",
          steps: ["Unwinding", step, "Folding", "Shipping"],
        },
        format: "order",
        skillId,
      }),
    ),
  );
}

describe(requestClaimQuestionsFor, () => {
  it("reads only the goal's own learner's goal", async () => {
    const { goal } = await setup();
    const other = await userFixture();

    await expect(
      requestClaimQuestionsFor({ goalId: goal.id, userId: other.id }),
    ).resolves.toStrictEqual({ status: "notFound" });
  });

  it("asks for tap questions only for a topic to confirm that has fewer than three left to ask", async () => {
    const { goal, nucleus, user, virus } = await setup();
    const request = { goalId: goal.id, userId: user.id };

    await orderTaps(virus.id);

    await expect(requestClaimQuestionsFor(request)).resolves.toMatchObject({
      analytics: { distinctId: user.id, goalId: goal.id },
      skillIds: [nucleus.id],
      status: "start",
    });

    await itemFixture({ content: choiceItemContent(), skillId: nucleus.id });

    await expect(requestClaimQuestionsFor(request)).resolves.toMatchObject({ status: "start" });

    await orderTaps(nucleus.id);

    await expect(requestClaimQuestionsFor(request)).resolves.toStrictEqual({ status: "ready" });
  });
});
