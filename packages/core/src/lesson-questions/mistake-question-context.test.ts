import { prisma } from "@zoonk/db";
import { mistakeFixture } from "@zoonk/testing/fixtures/learner";
import { playableLessonFixture } from "@zoonk/testing/fixtures/playable-lessons";
import { playableStepContent } from "@zoonk/testing/fixtures/playable-step-contents";
import { choiceItemContent, itemFixture, skillFixture } from "@zoonk/testing/fixtures/skills";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { parseMathItem } from "../learner/_utils/math-items";
import { discountMath, discountQuestion } from "../library/items/_test-utils/math-problems";
import { withRecordedNumbers } from "../library/items/item-math";
import { answerMistakePractice } from "../mistakes/answer-mistake-practice";
import { loadMistakeReplay } from "../mistakes/mistake-replay";
import { buildItemContextSnapshot } from "./_utils/item-context-snapshot";
import { claimLessonQuestionAnswer } from "./answer-lifecycle";
import { createLessonQuestion } from "./create-lesson-question";
import { getLessonQuestionThread } from "./get-lesson-question-thread";

async function setup() {
  const [user, { lesson, steps }] = await Promise.all([
    userFixture(),
    playableLessonFixture({ steps: [{ content: playableStepContent.check, kind: "check" }] }),
  ]);

  const step = steps[0];

  if (!step) {
    throw new Error("The fixture needs its question");
  }

  mockSession(user.id);
  const mistake = await mistakeFixture({ stepId: step.id, userId: user.id });
  const replay = await loadMistakeReplay({ mistake, userId: user.id });

  await prisma.mistake.update({
    data: { snapshot: { answer: "Wrong", question: playableStepContent.check.question, replay } },
    where: { id: mistake.id },
  });

  return { lesson, mistake, step, user };
}

describe("Original notebook questions", () => {
  it("keeps tutor context and history on the original notebook question after its step is deleted", async () => {
    const { lesson, step, mistake } = await setup();
    await prisma.step.delete({ where: { id: step.id } });

    const created = await createLessonQuestion({
      input: {
        context: { kind: "step", mistakeId: mistake.id, stepId: step.id, stepNumber: 1 },
        question: "Please explain this question.",
        requestId: crypto.randomUUID(),
      },
      target: { kind: "lesson", lessonId: lesson.id },
    });

    expect(created.status).toBe("created");

    if (created.status !== "created") {
      throw new Error("Expected the notebook tutor question");
    }

    const saved = await prisma.lessonQuestion.findUniqueOrThrow({
      where: { id: created.question.id },
    });

    expect(saved.libraryStepId).toBeNull();

    expect(saved.contextSnapshot).toMatchObject({
      mistakeId: mistake.id,
      step: { content: { question: playableStepContent.check.question } },
    });

    const thread = await getLessonQuestionThread({
      contextKind: "step",
      mistakeId: mistake.id,
      stepId: step.id,
      target: { kind: "lesson", lessonId: lesson.id },
    });

    expect(thread).toMatchObject({
      status: "ready",
      thread: { questions: [{ id: created.question.id }] },
    });
  });

  it("does not reuse an unfinished notebook question in a normal lesson", async () => {
    const { lesson, step, mistake } = await setup();
    const target = { kind: "lesson" as const, lessonId: lesson.id };

    const notebook = await createLessonQuestion({
      input: {
        context: { kind: "step", mistakeId: mistake.id, stepId: step.id, stepNumber: 1 },
        question: "Explain my original mistake.",
        requestId: crypto.randomUUID(),
      },
      target,
    });

    const current = await createLessonQuestion({
      input: {
        context: { kind: "step", stepId: step.id, stepNumber: 1 },
        question: "Explain this lesson question.",
        requestId: crypto.randomUUID(),
      },
      target,
    });

    expect(notebook.status).toBe("created");
    expect(current.status).toBe("created");

    if (notebook.status !== "created" || current.status !== "created") {
      throw new Error("Expected both tutor questions to be created");
    }

    expect(current.question.id).not.toBe(notebook.question.id);
    expect(current.question.question).toBe("Explain this lesson question.");

    await expect(
      claimLessonQuestionAnswer({ questionId: current.question.id }),
    ).resolves.toMatchObject({ claim: { priorTurns: [] }, status: "ready" });

    await prisma.lessonQuestion.update({
      data: { answer: "Current lesson explanation", status: "completed" },
      where: { id: current.question.id },
    });

    await expect(
      claimLessonQuestionAnswer({ questionId: notebook.question.id }),
    ).resolves.toMatchObject({ claim: { priorTurns: [] }, status: "ready" });

    await expect(
      getLessonQuestionThread({ contextKind: "step", stepId: step.id, target }),
    ).resolves.toMatchObject({ thread: { questions: [{ id: current.question.id }] } });
  });

  it("does not reuse a live question's shared explanation for a notebook original", async () => {
    const { lesson, step, mistake } = await setup();

    await prisma.tutorSharedAnswer.create({
      data: {
        answer: "Explanation for the rewritten question",
        generatedAt: new Date(),
        model: "test",
        promptVersion: "test",
        question: "Explain",
        runId: crypto.randomUUID(),
        stepId: step.id,
        suggestion: "simpler",
      },
    });

    const created = await createLessonQuestion({
      input: {
        context: { kind: "step", mistakeId: mistake.id, stepId: step.id, stepNumber: 1 },
        question: "Explain",
        requestId: crypto.randomUUID(),
        suggestion: "simpler",
      },
      target: { kind: "lesson", lessonId: lesson.id },
      wordSuggestion: async () => "Explain",
    });

    if (created.status !== "created") {
      throw new Error("Expected notebook question");
    }

    await expect(
      claimLessonQuestionAnswer({ questionId: created.question.id }),
    ).resolves.toMatchObject({ claim: { shareAnswer: false }, status: "ready" });
  });

  it("rejects a retried tutor request moved from its notebook entry to the normal lesson", async () => {
    const { lesson, step, mistake } = await setup();
    const requestId = crypto.randomUUID();
    const target = { kind: "lesson" as const, lessonId: lesson.id };
    const question = "Explain this question.";

    await createLessonQuestion({
      input: {
        context: { kind: "step", mistakeId: mistake.id, stepId: step.id, stepNumber: 1 },
        question,
        requestId,
      },
      target,
    });

    await expect(
      createLessonQuestion({
        input: { context: { kind: "step", stepId: step.id, stepNumber: 1 }, question, requestId },
        target,
      }),
    ).resolves.toMatchObject({ status: "conflict" });
  });

  it("refuses a foreign notebook context even when its public lesson is visible", async () => {
    const { lesson, step, mistake } = await setup();
    const other = await userFixture();
    mockSession(other.id);

    const created = await createLessonQuestion({
      input: {
        context: { kind: "step", mistakeId: mistake.id, stepId: step.id, stepNumber: 1 },
        question: "Explain this.",
        requestId: crypto.randomUUID(),
      },
      target: { kind: "lesson", lessonId: lesson.id },
    });

    expect(created.status).toBe("invalidContext");
  });

  it("uses the original bank question in notebook help after its live content changes", async () => {
    const user = await userFixture();
    const skill = await skillFixture();

    const item = await itemFixture({
      content: choiceItemContent("Original question"),
      skillId: skill.id,
    });

    const mistake = await mistakeFixture({
      itemId: item.id,
      skillId: item.skillId,
      userId: user.id,
    });

    const replay = await loadMistakeReplay({ mistake, userId: user.id });

    await prisma.mistake.update({
      data: { snapshot: { answer: "Wrong", question: "Original question", replay } },
      where: { id: mistake.id },
    });

    await prisma.item.update({
      data: { content: choiceItemContent("Replacement question") },
      where: { id: item.id },
    });

    await expect(
      buildItemContextSnapshot({
        context: { answered: false, kind: "item", mistakeId: mistake.id },
        itemId: item.id,
        userId: user.id,
      }),
    ).resolves.toMatchObject({ question: { text: "Original question" } });

    mockSession(user.id);

    await answerMistakePractice({
      input: { answer: { selectedIndex: 1 }, durationMs: 5000, itemId: item.id },
      mistakeId: mistake.id,
    });

    await expect(
      buildItemContextSnapshot({
        context: { answered: true, kind: "item", mistakeId: mistake.id },
        itemId: item.id,
        userId: user.id,
      }),
    ).resolves.toMatchObject({
      answer: { correctAnswer: "Right answer", isCorrect: false, learnerAnswer: "Wrong answer" },
      question: { text: "Original question" },
    });
  });

  it("gives the tutor the numeric serving and answer actually practiced", async () => {
    const user = await userFixture();
    const skill = await skillFixture();

    const row = await itemFixture({
      content: { context: null, math: discountMath, question: discountQuestion },
      format: "numeric",
      skillId: skill.id,
    });

    const item = parseMathItem(row);

    if (!item) {
      throw new Error("Expected a numeric item");
    }

    const math = withRecordedNumbers({
      ...item.content,
      language: item.language,
      values: { discount: 20, price: 100 },
    });

    const mistake = await mistakeFixture({
      itemId: item.id,
      skillId: skill.id,
      snapshot: { question: "Original numeric question", replay: { item, kind: "item", math } },
      userId: user.id,
    });

    mockSession(user.id);

    await answerMistakePractice({
      input: { answer: { number: 80 }, durationMs: 5000, itemId: item.id },
      mistakeId: mistake.id,
    });

    await expect(
      buildItemContextSnapshot({
        context: { answered: true, kind: "item", mistakeId: mistake.id },
        itemId: item.id,
        userId: user.id,
      }),
    ).resolves.toMatchObject({
      answer: { isCorrect: true, learnerAnswer: expect.stringContaining("80") },
      question: { text: "A shirt costs 100 and is 20% off. How much do you pay?" },
    });
  });
});
