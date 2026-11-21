import { prisma } from "@zoonk/db";
import { itemFixture } from "@zoonk/testing/fixtures/skills";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { mockSession } from "../../_test-utils/mock-session";
import { learnerGoalFixture } from "../_test-utils/learner-goal";
import { answerPlacementQuestion } from "./answer-placement-question";
import { getGoalPlacement } from "./get-goal-placement";

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
        itemsPerSkill: 1,
        phases: [1],
        userId: user.id,
      });

      const confirmation = await itemFixture({ content, format, skillId: skills[0]?.id ?? "" });

      mockSession(user.id);
      const first = await getGoalPlacement({ goalId: goal.id });

      expect(first).toMatchObject({
        placement: { next: { format: "multipleChoice" } },
        status: "ready",
      });

      if (first.status !== "ready" || !first.placement.next) {
        throw new Error("Expected a quick placement question");
      }

      const second = await answerPlacementQuestion({
        goalId: goal.id,
        input: {
          answer: { selectedIndex: 0 },
          durationMs: 100,
          itemId: first.placement.next.itemId,
        },
      });

      if (second.status !== "ready") {
        throw new Error("Expected a tap placement question after the answer");
      }

      expect(second.isCorrect).toBe(true);
      expect(second.placement.knownSkillIds).toStrictEqual([]);

      expect(second.placement.next).toStrictEqual({
        context: null,
        format,
        image: null,
        itemId: confirmation.id,
        question: content.question,
        skillId: confirmation.skillId,
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
