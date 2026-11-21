import { prisma } from "@zoonk/db";
import { itemFixture } from "@zoonk/testing/fixtures/skills";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { mockSession } from "../../_test-utils/mock-session";
import { learnerGoalFixture } from "../_test-utils/learner-goal";
import { answerPlacementQuestion } from "./answer-placement-question";
import { getGoalPlacement } from "./get-goal-placement";

describe("placement tap questions", () => {
  it("asks for a quick answer and then a tap confirmation on the same skill", async () => {
    const user = await userFixture();

    const { goal, skills } = await learnerGoalFixture({
      itemsPerSkill: 1,
      phases: [1],
      userId: user.id,
    });

    const order = await itemFixture({
      content: {
        question: "Put the steps in order",
        reason: "Sequence",
        steps: ["A", "B", "C", "D"],
      },
      format: "order",
      skillId: skills[0]?.id ?? "",
    });

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
      input: { answer: { selectedIndex: 0 }, durationMs: 100, itemId: first.placement.next.itemId },
    });

    expect(second).toMatchObject({
      isCorrect: true,
      placement: { knownSkillIds: [], next: { format: "order", itemId: order.id } },
      status: "ready",
    });
  });

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
