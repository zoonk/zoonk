import { prisma } from "@zoonk/db";
import { itemFixture } from "@zoonk/testing/fixtures/skills";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { mockSession } from "../../_test-utils/mock-session";
import { learnerGoalFixture } from "../_test-utils/learner-goal";
import { getGoalPlacement } from "./get-goal-placement";
import { startPlacementSitting } from "./start-placement-sitting";

describe("placement tap questions", () => {
  it.each([
    {
      content: {
        pairs: [
          { left: "A", right: "1" },
          { left: "B", right: "2" },
          { left: "C", right: "3" },
          { left: "D", right: "4" },
        ],
        question: "Match each letter to its position",
        reason: "The letters follow the alphabet",
      },
      expected: {
        key: null,
        left: ["A", "B", "C", "D"],
        options: null,
        right: expect.arrayContaining(["1", "2", "3", "4"]),
      },
      format: "matchPairs",
    },
    {
      content: {
        question: "Put the steps in order",
        reason: "Sequence",
        steps: ["A", "B", "C", "D"],
      },
      expected: { options: expect.arrayContaining(["A", "B", "C", "D"]) },
      format: "order",
    },
  ] as const)(
    "serves a $format confirmation with the placement question fields",
    async ({ content, expected, format }) => {
      const user = await userFixture();

      const { goal, skills } = await learnerGoalFixture({
        itemsPerSkill: 0,
        phases: [2],
        userId: user.id,
      });

      await Promise.all(
        skills.flatMap((skill) =>
          [0, 1].map(() => itemFixture({ content, format, skillId: skill.id })),
        ),
      );

      mockSession(user.id);
      const opened = await startPlacementSitting({ goalId: goal.id, input: {} });

      if (opened.status !== "ready" || !opened.placement.next) {
        throw new Error("Expected a tap question");
      }

      const next = opened.placement.next;

      expect(next).toStrictEqual({
        context: null,
        format,
        image: null,
        itemId: next.itemId,
        question: content.question,
        skillId: next.skillId,
        visual: null,
        ...expected,
      });
    },
  );

  it("keeps zero-answer skills unskipped even with a saved language level test", async () => {
    const user = await userFixture();
    const { goal } = await learnerGoalFixture({ itemsPerSkill: 0, phases: [2], userId: user.id });

    await prisma.goal.update({
      data: { details: { level: "C1", levelTest: {} }, kind: "language", targetLanguage: "en" },
      where: { id: goal.id },
    });

    mockSession(user.id);

    await expect(getGoalPlacement({ goalId: goal.id })).resolves.toMatchObject({
      placement: { knownSkillIds: [] },
      status: "ready",
    });
  });
});
