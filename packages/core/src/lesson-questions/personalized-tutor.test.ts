import { randomUUID } from "node:crypto";
import { streamLessonQuestionAnswer } from "@zoonk/ai/tasks/lessons/question";
import { streamGoalTutorAnswer } from "@zoonk/ai/tasks/tutor/goal-tutor";
import { prisma } from "@zoonk/db";
import { goalFixture, planFixture } from "@zoonk/testing/fixtures/goals";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { memoryFactFixture } from "@zoonk/testing/fixtures/memory";
import { describe, expect, it, vi } from "vitest";
import { createLessonQuestionFixture } from "./_test-utils/create-question";
import { claimLessonQuestionAnswer } from "./answer-lifecycle";
import { createLessonQuestion } from "./create-lesson-question";
import { startTutorAnswer } from "./tutor-answer";

vi.mock("@zoonk/ai/tasks/lessons/question", async (original) => ({
  ...(await original<object>()),
  streamLessonQuestionAnswer: vi.fn(),
}));

vi.mock("@zoonk/ai/tasks/tutor/goal-tutor", async (original) => ({
  ...(await original<object>()),
  streamGoalTutorAnswer: vi.fn(),
}));

const NEEDS = ["stepByStep", "plainWords", "shorterDays"] as const;

async function questionWithNeeds(task: "goal" | "lesson") {
  const fixture = await createLessonQuestionFixture();

  await learningProfileFixture({
    learningNeeds: [...NEEDS],
    memoryEnabled: false,
    userId: fixture.user.id,
  });

  await prisma.learnerCondition.createMany({
    data: [
      { condition: "dyscalculia", userId: fixture.user.id },
      { condition: "motor", userId: fixture.user.id },
      { condition: "other", note: "I need time to read", userId: fixture.user.id },
    ],
  });

  if (task === "lesson") {
    return fixture;
  }

  const goal = await goalFixture({ userId: fixture.user.id });
  await planFixture({ goalId: goal.id, graph: { phases: [], skills: [] } });

  const created = await createLessonQuestion({
    input: { context: { kind: "plan" }, question: "What comes next?", requestId: randomUUID() },
    target: { goalId: goal.id, kind: "plan" },
  });

  if (created.status !== "created") {
    throw new Error(`Expected a created question, got ${created.status}`);
  }

  return { ...fixture, question: created.question };
}

describe("personal tutor inputs", () => {
  it.each(["goal", "lesson"] as const)(
    "passes needs and consented conditions to the %s task with memory off",
    async (task) => {
      const { question } = await questionWithNeeds(task);
      const claimed = await claimLessonQuestionAnswer({ questionId: question.id });

      if (claimed.status !== "ready") {
        throw new Error(`Expected a ready claim, got ${claimed.status}`);
      }

      startTutorAnswer(claimed.claim);
      const generate = task === "goal" ? streamGoalTutorAnswer : streamLessonQuestionAnswer;

      const variants =
        task === "goal"
          ? [...NEEDS, "dyscalculia", "other"]
          : ["stepByStep", "plainWords", "dyscalculia", "other"];

      expect(generate).toHaveBeenCalledWith(
        expect.objectContaining({
          learnerMemory: [],
          learnerNeeds: { note: "I need time to read", variants },
        }),
      );
    },
  );

  it("reads background, context and sensitive support notes for a private answer", async () => {
    const { question, user } = await createLessonQuestionFixture();

    const facts = await Promise.all([
      memoryFactFixture({
        category: "background",
        statement: "Studied journalism",
        userId: user.id,
      }),
      memoryFactFixture({ category: "context", statement: "Watches Star Trek", userId: user.id }),
      memoryFactFixture({
        category: "learning",
        sensitive: true,
        sourceRef: { id: "learningSupport", kind: "profile" },
        statement: "I need time to read",
        userId: user.id,
      }),
    ]);

    await expect(claimLessonQuestionAnswer({ questionId: question.id })).resolves.toMatchObject({
      claim: { learnerMemory: expect.arrayContaining(facts.map(({ statement }) => statement)) },
    });

    const used = await prisma.memoryFact.findMany({
      where: { lastUsedAt: { not: null }, userId: user.id },
    });

    expect(used).toHaveLength(3);
  });
});
