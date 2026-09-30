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
import { testOutQuestionsWorkflow } from "./test-out-questions-workflow";

// Writing questions is a paid model call.
vi.mock("@zoonk/ai/tasks/v2/items/placement-items", () => ({ generatePlacementItems: vi.fn() }));

const writtenItem = {
  context: null,
  difficulty: "easy" as const,
  format: "multipleChoice" as const,
  options: [
    { isCorrect: true, misconception: null, reason: "Area is length times width.", text: "12" },
    {
      isCorrect: false,
      misconception: "Adds the sides instead of multiplying",
      reason: "Adding gives the perimeter's half, not the area.",
      text: "7",
    },
  ],
  question: "A rectangle is 3 by 4. What is its area?",
};

function streamedSteps() {
  return getStreamedEvents().map((event) => `${String(event.step)}:${String(event.status)}`);
}

async function goalWithSkills() {
  const user = await userFixture();

  const [goal, withoutItems, withItem] = await Promise.all([
    goalFixture({ userId: user.id }),
    skillFixture({ name: "Rectangle area" }),
    skillFixture({ name: "Triangle area" }),
  ]);

  await itemFixture({ content: choiceItemContent(), skillId: withItem.id });

  return { goal, withItem, withoutItems };
}

describe(testOutQuestionsWorkflow, () => {
  beforeEach(() => {
    vi.mocked(generatePlacementItems).mockReset();
  });

  it("writes multiple-choice questions for the skills without one, saying so on its stream", async () => {
    const { goal, withItem, withoutItems } = await goalWithSkills();

    vi.mocked(generatePlacementItems).mockResolvedValue(
      taskResult({ skills: [{ quick: [writtenItem], typed: [] }] }),
    );

    await expect(
      testOutQuestionsWorkflow({
        chapterId: "chapter-id",
        goalId: goal.id,
        skillIds: [withoutItems.id, withItem.id],
      }),
    ).resolves.toStrictEqual({ status: "written" });

    expect(vi.mocked(createHook)).toHaveBeenCalledWith({
      token: `test-out-questions:${goal.id}:chapter-id`,
    });

    // One call, for the skill that had none, in the only format a test-out asks.
    expect(generatePlacementItems).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        quickCount: 3,
        quickFormat: "multipleChoice",
        serviceTier: "priority",
        skills: [expect.objectContaining({ name: "Rectangle area" })],
        typedCount: 0,
      }),
    );

    await expect(
      prisma.item.count({ where: { format: "multipleChoice", skillId: withoutItems.id } }),
    ).resolves.toBe(1);

    expect(streamedSteps()).toStrictEqual([
      "writeTestOutQuestions:started",
      "testOutQuestionsReady:completed",
    ]);
  });

  it("fails on its stream when no question could be written", async () => {
    const { goal, withoutItems } = await goalWithSkills();
    vi.mocked(generatePlacementItems).mockRejectedValue(new Error("Provider unavailable"));

    await expect(
      testOutQuestionsWorkflow({
        chapterId: "chapter-id",
        goalId: goal.id,
        skillIds: [withoutItems.id],
      }),
    ).resolves.toStrictEqual({ status: "failed" });

    expect(streamedSteps()).toStrictEqual(["writeTestOutQuestions:started", "workflowError:error"]);
  });

  it("joins the run already writing the chapter's questions", async () => {
    mockHookConflict({ returnValue: Promise.resolve(null), runId: "writing-run" });

    await expect(
      testOutQuestionsWorkflow({ chapterId: "chapter-id", goalId: "goal-id", skillIds: [] }),
    ).resolves.toStrictEqual({ status: "joined" });

    expect(generatePlacementItems).not.toHaveBeenCalled();

    expect(getStreamedEvents()).toStrictEqual([
      { entityId: "writing-run", status: "started", step: "joinTestOutQuestions" },
    ]);
  });
});
