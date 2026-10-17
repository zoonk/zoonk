import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { attemptFixture, mistakeFixture } from "@zoonk/testing/fixtures/learner";
import { choiceItemContent, itemFixture } from "@zoonk/testing/fixtures/skills";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { runDeferredWork } from "../_test-utils/deferred-work";
import { mockSession } from "../_test-utils/mock-session";
import { trackServerEvent } from "../analytics/server";
import { learnerGoalFixture } from "../learner/_test-utils/learner-goal";
import { updateMemoryFromActivity } from "../memory/update-memory-from-activity";
import { parseLessonQuestionContextSnapshot } from "./_utils/context-snapshot-schema";
import { type LessonQuestionContextInput } from "./contract";
import { createLessonQuestion } from "./create-lesson-question";
import { getLessonQuestionThread } from "./get-lesson-question-thread";

vi.mock("../memory/update-memory-from-activity", () => ({ updateMemoryFromActivity: vi.fn() }));

/** A learner with a goal, and a question of their goal's skill as practice asks it. */
async function practiceQuestion() {
  const user = await userFixture();
  const { skills } = await learnerGoalFixture({ itemsPerSkill: 0, phases: [1], userId: user.id });

  const item = await itemFixture({
    content: choiceItemContent("Which number is even?"),
    skillId: skills[0]?.id ?? "",
  });

  await mistakeFixture({ itemId: item.id, skillId: item.skillId, userId: user.id });

  mockSession(user.id);
  return { item, user };
}

function ask({ context, itemId }: { context: LessonQuestionContextInput; itemId: string }) {
  return createLessonQuestion({
    input: { context, question: "Can you give me a hint?", requestId: randomUUID() },
    target: { itemId, kind: "item" },
  });
}

async function askedScreen(result: Awaited<ReturnType<typeof ask>>) {
  const questionId = result.status === "created" ? result.question.id : "";
  const stored = await prisma.lessonQuestion.findUniqueOrThrow({ where: { id: questionId } });
  const snapshot = parseLessonQuestionContextSnapshot(stored.contextSnapshot);

  return "screen" in snapshot ? snapshot.screen : null;
}

describe("asking the buddy about a session's or practice's question", () => {
  beforeEach(() => {
    vi.mocked(updateMemoryFromActivity).mockResolvedValue([]);
    mockSession(null);
  });

  it("shows the question without its answer before the check, and the learner's answer after it", async () => {
    const { item, user } = await practiceQuestion();
    const flush = runDeferredWork();

    const before = await ask({ context: { answered: false, kind: "item" }, itemId: item.id });
    await flush();

    expect(before).toMatchObject({ question: { context: { kind: "item" } }, status: "created" });

    await expect(askedScreen(before)).resolves.toStrictEqual({
      answer: null,
      language: item.language,
      question: {
        format: "multipleChoice",
        options: ["Right answer", "Wrong answer"],
        text: "Which number is even?",
      },
      scope: { kind: "item" },
      set: null,
      skill: expect.any(String),
      version: 1,
    });

    expect(trackServerEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Tutor Asked",
        properties: { item_id: item.id, scope: "item" },
      }),
    );

    // The buddy answered the hint; then the learner checks a wrong answer and asks again.
    await prisma.lessonQuestion.updateMany({
      data: { answer: "Even numbers end in 0, 2, 4, 6 or 8.", status: "completed" },
      where: { thread: { userId: user.id } },
    });

    await attemptFixture({
      answer: { selectedIndex: 1 },
      isCorrect: false,
      itemId: item.id,
      userId: user.id,
    });

    const after = await ask({ context: { answered: true, kind: "item" }, itemId: item.id });

    await expect(askedScreen(after)).resolves.toMatchObject({
      answer: { correctAnswer: "Right answer", isCorrect: false, learnerAnswer: "Wrong answer" },
    });

    // One thread per question, both turns in it.
    await expect(
      getLessonQuestionThread({ target: { itemId: item.id, kind: "item" } }),
    ).resolves.toMatchObject({ status: "ready", thread: { questions: [{}, {}] } });

    await expect(
      prisma.lessonQuestionThread.findMany({ where: { userId: user.id } }),
    ).resolves.toMatchObject([{ itemId: item.id, kind: "item" }]);
  });

  it("keeps a question on a mock the learner is sitting, and a block that isn't theirs, out", async () => {
    const { item, user } = await practiceQuestion();

    await expect(
      ask({ context: { answered: false, blockId: randomUUID(), kind: "item" }, itemId: item.id }),
    ).resolves.toStrictEqual({ status: "invalidContext" });

    await prisma.mockExam.create({
      data: {
        conditions: {
          day: null,
          fullLength: true,
          scoring: "raw",
          sections: [{ itemIds: [item.id], minutes: 60, name: null, questions: 1, routing: null }],
          startTime: null,
          timeZone: null,
        },
        sectionStartedAt: new Date(),
        userId: user.id,
      },
    });

    await expect(
      ask({ context: { answered: false, kind: "item" }, itemId: item.id }),
    ).resolves.toStrictEqual({ status: "notFound" });

    mockSession(null);

    await expect(
      ask({ context: { answered: false, kind: "item" }, itemId: item.id }),
    ).resolves.toStrictEqual({ status: "unauthorized" });
  });
});
