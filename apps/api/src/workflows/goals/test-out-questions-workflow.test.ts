import { generatePlacementItems } from "@zoonk/ai/tasks/items/placement-items";
import { getChapterTestOut } from "@zoonk/core/learner/test-out/get";
import { submitChapterTestOut } from "@zoonk/core/learner/test-out/submit";
import { prisma } from "@zoonk/db";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { choiceItemContent, itemFixture, skillFixture } from "@zoonk/testing/fixtures/skills";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../../../../../packages/core/src/_test-utils/mock-session";
import { learnerGoalFixture } from "../../../../../packages/core/src/learner/_test-utils/learner-goal";
import { lowGuessTapItems } from "../../../../../packages/core/src/learner/_test-utils/placement-tap-items";
import { getStreamedEvents } from "../_test-utils/parse-stream-events";
import { taskResult } from "../_test-utils/recorded-outputs";
import { testOutQuestionsWorkflow } from "./test-out-questions-workflow";

vi.mock("@zoonk/core/users/session", () => ({ getSession: vi.fn() }));

const writtenItem = {
  context: null,
  difficulty: "easy" as const,
  fixedOrder: false,
  format: "multipleChoice" as const,
  image: null,
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
  visual: null,
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

  it("writes multiple-choice questions for the skills without one and tap questions for both, saying so on its stream", async () => {
    const { goal, withItem, withoutItems } = await goalWithSkills();

    vi.mocked(generatePlacementItems).mockImplementation(async (params) =>
      taskResult({
        skills: params.skills.map((skill) => ({
          quick: skill.quickCount > 0 ? [writtenItem] : [],
          taps: [],
        })),
      }),
    );

    await expect(
      testOutQuestionsWorkflow({
        chapterId: "chapter-id",
        goalId: goal.id,
        skillIds: [withoutItems.id, withItem.id],
      }),
    ).resolves.toStrictEqual({ status: "written" });

    expect(
      vi
        .mocked(generatePlacementItems)
        .mock.calls.map(([params]) =>
          params.skills.map((skill) => [skill.name, skill.quickCount, skill.tapCount]),
        ),
    ).toStrictEqual([
      [["Rectangle area", 1, 0]],
      [["Rectangle area", 0, 3]],
      [["Triangle area", 0, 3]],
    ]);

    await expect(
      prisma.item.count({ where: { format: "multipleChoice", skillId: withoutItems.id } }),
    ).resolves.toBe(1);

    expect(streamedSteps()).toStrictEqual([
      "writeTestOutQuestions:started",
      "testOutQuestionsReady:completed",
    ]);
  });

  it("replaces consumed taps after a failed chapter test and keeps the unused quick question", async () => {
    const user = await userFixture();

    const { chapters, goal, skills } = await learnerGoalFixture({
      itemsPerSkill: 2,
      phases: [1],
      userId: user.id,
    });

    mockSession(user.id);
    const path = { chapterId: chapters[0]!.id, goalId: goal.id };
    const skillId = skills[0]!.id;
    await lowGuessTapItems(skillId);
    const first = await getChapterTestOut(path);

    if (first.status !== "ready") {
      throw new Error("Expected the chapter test");
    }

    const used = first.testOut.questions.map(({ itemId }) => itemId);
    expect(used).toHaveLength(4);

    await expect(
      submitChapterTestOut({
        ...path,
        input: {
          answers: used.map((itemId) => ({ answer: { dontKnow: true }, durationMs: 1000, itemId })),
          requestId: crypto.randomUUID(),
        },
      }),
    ).resolves.toMatchObject({ outcome: { passed: false }, status: "ready" });

    await expect(getChapterTestOut(path)).resolves.toMatchObject({
      testOut: { needsItems: [skillId], questions: [] },
    });

    vi.mocked(generatePlacementItems).mockImplementation(async ({ skills: picks }) =>
      taskResult({
        skills: picks.map(({ tapCount }) => ({
          quick: [],
          taps: Array.from({ length: tapCount }, (_, index) => ({
            difficulty: "medium" as const,
            format: "order" as const,
            question: `Order the steps for example ${index + 1}.`,
            reason: "Each step builds on the previous one.",
            steps: ["First", "Second", "Third", "Fourth"],
          })),
        })),
      }),
    );

    const request = { ...path, skillIds: [skillId] };
    await testOutQuestionsWorkflow(request);
    const retake = await getChapterTestOut(path);
    expect(retake).toMatchObject({ testOut: { needsItems: [] } });
    const fresh = retake.status === "ready" ? retake.testOut.questions : [];
    expect(fresh).toHaveLength(4);
    expect(fresh.every(({ itemId }) => !used.includes(itemId))).toBe(true);
    await testOutQuestionsWorkflow(request);

    expect(
      vi.mocked(generatePlacementItems).mock.calls.map(([params]) => params.skills),
    ).toMatchObject([[{ quickCount: 0, tapCount: 3 }]]);
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
});
