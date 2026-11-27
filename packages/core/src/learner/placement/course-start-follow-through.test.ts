import { prisma } from "@zoonk/db";
import { choiceItemContent, itemFixture } from "@zoonk/testing/fixtures/skills";
import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { mockSession } from "../../_test-utils/mock-session";
import { answerStudyQuestion } from "../../sessions/answer-study-question";
import { startStudyBlock } from "../../sessions/start-study-block";
import { coursePlacementSitting } from "../_test-utils/course-placement-sitting";
import { learnerGoalFixture } from "../_test-utils/learner-goal";
import { finishGoalPlacement } from "./finish-goal-placement";

async function setup() {
  const user = await userFixture();
  const fixture = await learnerGoalFixture({ itemsPerSkill: 0, phases: [5], userId: user.id });
  mockSession(user.id);
  const goalId = fixture.goal.id;

  const finish = async () => {
    const sitting = await coursePlacementSitting(
      goalId,
      fixture.skills.map((skill) => skill.id),
    );

    await sitting.answerAll();
    return finishGoalPlacement({ goalId, input: { attemptId: sitting.attemptId } });
  };

  return { ...fixture, finish, goalId, user };
}

describe("course placement after completion", () => {
  it("returns the lessons on the first practice miss", async () => {
    const { finish, goalId, plan, skills, user } = await setup();
    await finish();
    const skillId = skills[0]!.id;
    const where = { kind: "lesson" as const, planId: plan.id, skillId };

    await expect(prisma.planItem.findFirstOrThrow({ where })).resolves.toMatchObject({
      status: "testedOut",
    });

    const item = await itemFixture({ content: choiceItemContent(), skillId });
    const session = await studySessionFixture({ goalId, userId: user.id });

    const block = await studySessionBlockFixture({
      kind: "practice",
      payload: { itemIds: [item.id], skillIds: [skillId] },
      sessionId: session.id,
    });

    await startStudyBlock({ blockId: block.id, input: {}, sessionId: session.id });

    await answerStudyQuestion({
      blockId: block.id,
      input: { answer: { dontKnow: true }, durationMs: 4000, itemId: item.id },
      sessionId: session.id,
    });

    await expect(prisma.planItem.findFirstOrThrow({ where })).resolves.toMatchObject({
      status: "todo",
    });
  });
});
