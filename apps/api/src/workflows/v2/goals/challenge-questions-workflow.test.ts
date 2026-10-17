import { generatePlacementItems } from "@zoonk/ai/tasks/v2/items/placement-items";
import { prisma } from "@zoonk/db";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { choiceItemContent, itemFixture, skillFixture } from "@zoonk/testing/fixtures/skills";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createHook } from "workflow";
import { mockHookConflict } from "../../../../mocks/workflow";
import { getStreamedEvents } from "../../_test-utils/parse-stream-events";
import { taskResult } from "../_test-utils/recorded-outputs";
import { challengeQuestionsWorkflow } from "./challenge-questions-workflow";

function writtenItem(sides: [number, number]) {
  const [width, height] = sides;

  return {
    context: null,
    difficulty: "easy" as const,
    fixedOrder: false,
    format: "multipleChoice" as const,
    image: null,
    options: [
      {
        isCorrect: true,
        misconception: null,
        reason: "Area is length times width.",
        text: String(width * height),
      },
      {
        isCorrect: false,
        misconception: "Adds the sides instead of multiplying",
        reason: "Adding the sides doesn't give the area.",
        text: String(width + height),
      },
    ],
    question: `A rectangle is ${width} by ${height}. What is its area?`,
    visual: null,
  };
}

function streamedSteps() {
  return getStreamedEvents().map((event) => `${String(event.step)}:${String(event.status)}`);
}

/** A goal whose challenge asks two skills: one with no questions, one that holds two. */
async function challengeSkills() {
  const user = await userFixture();

  const [goal, empty, held] = await Promise.all([
    goalFixture({ userId: user.id }),
    skillFixture({ name: "Rectangle area" }),
    skillFixture({ name: "Triangle area" }),
  ]);

  await Promise.all([
    itemFixture({ content: choiceItemContent(), skillId: held.id }),
    itemFixture({ content: choiceItemContent(), skillId: held.id }),
  ]);

  return { empty, goal, held };
}

describe(challengeQuestionsWorkflow, () => {
  beforeEach(() => {
    vi.mocked(generatePlacementItems).mockReset();
  });

  // A write decided before another run filled a skill must not write it again: nothing past the
  // challenge's size.
  it("writes what a skill lacks, skipping one that holds its share by now, in the background", async () => {
    const { empty, goal, held } = await challengeSkills();

    vi.mocked(generatePlacementItems).mockResolvedValue(
      taskResult({ skills: [{ quick: [writtenItem([3, 4]), writtenItem([5, 6])], typed: [] }] }),
    );

    await expect(
      challengeQuestionsWorkflow({
        goalId: goal.id,
        key: "phase-skills",
        later: true,
        quickFormat: "multipleChoice",
        writes: [{ questionsPerSkill: 2, skillIds: [empty.id, held.id], target: 2 }],
      }),
    ).resolves.toStrictEqual({ status: "written" });

    expect(vi.mocked(createHook)).toHaveBeenCalledWith({
      token: "challenge-questions:phase-skills",
    });

    expect(generatePlacementItems).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        quickCount: 2,
        quickFormat: "multipleChoice",
        serviceTier: "flex",
        skills: [expect.objectContaining({ name: "Rectangle area" })],
        typedCount: 0,
      }),
    );

    await expect(prisma.item.count({ where: { skillId: empty.id } })).resolves.toBe(2);

    expect(streamedSteps()).toStrictEqual([
      "writeChallengeQuestions:started",
      "challengeQuestionsReady:completed",
    ]);
  });

  it("fails on its stream when no question could be written", async () => {
    const { empty, goal } = await challengeSkills();
    vi.mocked(generatePlacementItems).mockRejectedValue(new Error("Provider unavailable"));

    await expect(
      challengeQuestionsWorkflow({
        goalId: goal.id,
        key: "phase-skills",
        later: false,
        quickFormat: "multipleChoice",
        writes: [{ questionsPerSkill: 3, skillIds: [empty.id], target: 3 }],
      }),
    ).resolves.toStrictEqual({ status: "failed" });

    expect(streamedSteps()).toStrictEqual([
      "writeChallengeQuestions:started",
      "workflowError:error",
    ]);
  });

  // The session's preparation writing them ahead and the learner's tap on Start, or two learners
  // reaching the same phase, write them once.
  it("joins the run already writing the same skills' questions", async () => {
    mockHookConflict({ returnValue: Promise.resolve(null), runId: "writing-run" });

    await expect(
      challengeQuestionsWorkflow({
        goalId: "goal-id",
        key: "phase-skills",
        later: false,
        quickFormat: "multipleChoice",
        writes: [{ questionsPerSkill: 3, skillIds: ["skill-id"], target: 3 }],
      }),
    ).resolves.toStrictEqual({ status: "joined" });

    expect(generatePlacementItems).not.toHaveBeenCalled();

    expect(getStreamedEvents()).toStrictEqual([
      { entityId: "writing-run", status: "started", step: "joinChallengeQuestions" },
    ]);
  });
});
