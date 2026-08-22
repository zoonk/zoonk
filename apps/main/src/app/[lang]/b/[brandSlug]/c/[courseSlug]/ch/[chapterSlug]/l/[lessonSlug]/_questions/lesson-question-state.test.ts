import { type LessonQuestionResource } from "@zoonk/core/lesson-questions/contract";
import { type SerializedStep } from "@zoonk/core/player/contracts/prepare-lesson-data";
import { type PlayerQuestionContext } from "@zoonk/player/provider";
import { describe, expect, it } from "vitest";
import { INITIAL_LESSON_QUESTION_STATE, lessonQuestionReducer } from "./lesson-question-state";

function questionResource(overrides?: Partial<LessonQuestionResource>): LessonQuestionResource {
  return {
    answer: null,
    context: { kind: "lesson" },
    createdAt: "2026-08-21T12:00:00.000Z",
    id: "0198ca70-9c50-7000-8000-000000000001",
    question: "How does this work?",
    status: "pending",
    updatedAt: "2026-08-21T12:00:00.000Z",
    ...overrides,
  };
}

const LESSON_CONTEXT = { kind: "lesson" } satisfies PlayerQuestionContext;

function stepContext(id: string): PlayerQuestionContext {
  const step = {
    content: { text: "Visible lesson material", title: "A concept", variant: "text" },
    fillBlankOptions: [],
    id,
    kind: "static",
    matchColumnsRightItems: [],
    position: 0,
    sentence: null,
    sentenceWordOptions: [],
    sortOrderItems: [],
    translationOptions: [],
    vocabularyOptions: [],
    word: null,
    wordBankOptions: [],
  } satisfies SerializedStep;

  return { kind: "step", step, stepIndex: 0 };
}

function answerContext(selectedOptionId: string): PlayerQuestionContext {
  const context = stepContext("0198ca70-9c50-7000-8000-000000000010");

  if (context.kind !== "step") {
    throw new Error("Expected a step context");
  }

  const selectedAnswer = { kind: "multipleChoice" as const, selectedOptionId };

  return {
    kind: "answer",
    result: {
      answer: selectedAnswer,
      result: { correctAnswer: "Answer A", feedback: "Try again", isCorrect: false },
      stepId: context.step.id,
    },
    selectedAnswer,
    step: context.step,
    stepIndex: context.stepIndex,
  };
}

describe(lessonQuestionReducer, () => {
  it("preserves the draft and lesson history when the panel is closed and reopened", () => {
    const opened = lessonQuestionReducer(INITIAL_LESSON_QUESTION_STATE, {
      context: LESSON_CONTEXT,
      type: "open",
    });

    const drafted = lessonQuestionReducer(opened, {
      draft: "Can you give me an example?",
      type: "draftChanged",
    });

    const loaded = lessonQuestionReducer(drafted, {
      hasMore: false,
      nextCursor: null,
      questions: [questionResource({ answer: "Here is an example.", status: "completed" })],
      type: "threadLoaded",
    });

    const closed = lessonQuestionReducer(loaded, { type: "close" });
    const reopened = lessonQuestionReducer(closed, { context: LESSON_CONTEXT, type: "open" });

    expect(reopened.isOpen).toBe(true);
    expect(reopened.draft).toBe("Can you give me an example?");
    expect(reopened.questions).toHaveLength(1);
  });

  it("clears an unsent draft before opening a different learning context", () => {
    const firstContext = stepContext("0198ca70-9c50-7000-8000-000000000010");
    const secondContext = stepContext("0198ca70-9c50-7000-8000-000000000011");

    const opened = lessonQuestionReducer(INITIAL_LESSON_QUESTION_STATE, {
      context: firstContext,
      type: "open",
    });

    const drafted = lessonQuestionReducer(opened, {
      draft: "Why does this step work?",
      type: "draftChanged",
    });

    const reopened = lessonQuestionReducer(drafted, { context: secondContext, type: "open" });

    expect(reopened.draft).toBe("");
  });

  it("clears an unsent draft when the learner asks about a different answer", () => {
    const opened = lessonQuestionReducer(INITIAL_LESSON_QUESTION_STATE, {
      context: answerContext("answer-b"),
      type: "open",
    });

    const drafted = lessonQuestionReducer(opened, {
      draft: "Why was this answer wrong?",
      type: "draftChanged",
    });

    const reopened = lessonQuestionReducer(drafted, {
      context: answerContext("answer-c"),
      type: "open",
    });

    expect(reopened.draft).toBe("");
  });

  it("streams an answer onto the durable question and completes it", () => {
    const question = questionResource();

    const created = lessonQuestionReducer(INITIAL_LESSON_QUESTION_STATE, {
      question,
      type: "questionCreated",
    });

    const started = lessonQuestionReducer(created, {
      questionId: question.id,
      type: "answerStarted",
    });

    const firstChunk = lessonQuestionReducer(started, {
      chunk: "Gravity ",
      questionId: question.id,
      type: "answerChunkReceived",
    });

    const secondChunk = lessonQuestionReducer(firstChunk, {
      chunk: "bends the path.",
      questionId: question.id,
      type: "answerChunkReceived",
    });

    const completed = lessonQuestionReducer(secondChunk, {
      questionId: question.id,
      type: "answerCompleted",
    });

    expect(completed.questions[0]).toMatchObject({
      answer: "Gravity bends the path.",
      status: "completed",
    });

    expect(completed.activeQuestionId).toBeNull();
  });

  it("keeps a failed question available for an explicit retry", () => {
    const question = questionResource({ answer: "Partial", status: "running" });

    const loaded = lessonQuestionReducer(INITIAL_LESSON_QUESTION_STATE, {
      hasMore: false,
      nextCursor: null,
      questions: [question],
      type: "threadLoaded",
    });

    const failed = lessonQuestionReducer(loaded, {
      questionId: question.id,
      reason: { kind: "unknown" },
      type: "answerFailed",
    });

    const retried = lessonQuestionReducer(failed, {
      questionId: question.id,
      type: "answerStarted",
    });

    expect(failed.questions[0]).toMatchObject({ answer: "Partial", status: "failed" });

    expect(failed.answerError).toStrictEqual({
      questionId: question.id,
      reason: { kind: "unknown" },
    });

    expect(retried.questions[0]).toMatchObject({ answer: null, status: "running" });
    expect(retried.activeQuestionId).toBe(question.id);
  });

  it("reconciles a locally streaming answer with its durable thread state", () => {
    const question = questionResource();

    const created = lessonQuestionReducer(INITIAL_LESSON_QUESTION_STATE, {
      question,
      type: "questionCreated",
    });

    const started = lessonQuestionReducer(created, {
      questionId: question.id,
      type: "answerStarted",
    });

    const reconciled = lessonQuestionReducer(started, {
      hasMore: false,
      nextCursor: null,
      questions: [questionResource({ answer: "Saved answer", status: "completed" })],
      type: "threadLoaded",
    });

    expect(reconciled.activeQuestionId).toBeNull();
    expect(reconciled.questions[0]).toMatchObject({ answer: "Saved answer", status: "completed" });
  });

  it("keeps saved questions visible when a background refresh fails", () => {
    const question = questionResource({ answer: "Saved answer", status: "completed" });

    const loaded = lessonQuestionReducer(INITIAL_LESSON_QUESTION_STATE, {
      hasMore: false,
      nextCursor: null,
      questions: [question],
      type: "threadLoaded",
    });

    const refreshing = lessonQuestionReducer(loaded, { type: "threadLoadStarted" });

    const failed = lessonQuestionReducer(refreshing, {
      reason: { kind: "unknown" },
      type: "threadLoadFailed",
    });

    expect(refreshing.loadStatus).toBe("ready");
    expect(failed.questions).toStrictEqual([question]);
    expect(failed.error).toBeNull();
  });

  it("merges an idempotent replay with its newer durable answer", () => {
    const pendingQuestion = questionResource();

    const loaded = lessonQuestionReducer(INITIAL_LESSON_QUESTION_STATE, {
      hasMore: false,
      nextCursor: null,
      questions: [pendingQuestion],
      type: "threadLoaded",
    });

    const replayed = lessonQuestionReducer(loaded, {
      question: questionResource({
        answer: "Completed in another tab",
        id: pendingQuestion.id,
        status: "completed",
      }),
      type: "questionCreated",
    });

    expect(replayed.questions).toHaveLength(1);

    expect(replayed.questions[0]).toMatchObject({
      answer: "Completed in another tab",
      status: "completed",
    });
  });

  it("prepends earlier history without duplicating the visible page", () => {
    const firstQuestion = questionResource({ id: "0198ca70-9c50-7000-8000-000000000001" });
    const secondQuestion = questionResource({ id: "0198ca70-9c50-7000-8000-000000000002" });
    const thirdQuestion = questionResource({ id: "0198ca70-9c50-7000-8000-000000000003" });

    const loaded = lessonQuestionReducer(INITIAL_LESSON_QUESTION_STATE, {
      hasMore: true,
      nextCursor: secondQuestion.id,
      questions: [secondQuestion, thirdQuestion],
      type: "threadLoaded",
    });

    const earlier = lessonQuestionReducer(loaded, {
      hasMore: false,
      nextCursor: null,
      questions: [firstQuestion, secondQuestion],
      type: "earlierThreadLoaded",
    });

    expect(earlier.questions.map((question) => question.id)).toStrictEqual([
      firstQuestion.id,
      secondQuestion.id,
      thirdQuestion.id,
    ]);

    expect(earlier.hasMore).toBe(false);
    expect(earlier.nextCursor).toBeNull();

    const reconciled = lessonQuestionReducer(earlier, {
      questions: [
        questionResource({
          answer: "Updated latest answer",
          id: thirdQuestion.id,
          status: "completed",
        }),
      ],
      type: "latestThreadReconciled",
    });

    expect(reconciled.questions.map((question) => question.id)).toStrictEqual([
      firstQuestion.id,
      secondQuestion.id,
      thirdQuestion.id,
    ]);

    expect(reconciled.questions[2]?.answer).toBe("Updated latest answer");
  });

  it("preserves a typed question when creating it fails", () => {
    const drafted = lessonQuestionReducer(INITIAL_LESSON_QUESTION_STATE, {
      draft: "Why is my answer wrong?",
      type: "draftChanged",
    });

    const failed = lessonQuestionReducer(drafted, {
      reason: { kind: "unknown" },
      type: "questionCreateFailed",
    });

    expect(failed.draft).toBe("Why is my answer wrong?");
    expect(failed.error).toBe("create");
    expect(failed.requestError).toStrictEqual({ kind: "unknown" });
  });

  it("preserves a new draft typed while the previous question is being created", () => {
    const creating = lessonQuestionReducer(
      { ...INITIAL_LESSON_QUESTION_STATE, draft: "First question" },
      { type: "questionCreateStarted" },
    );

    const edited = lessonQuestionReducer(creating, {
      draft: "A follow-up typed while waiting",
      type: "draftChanged",
    });

    const created = lessonQuestionReducer(edited, {
      question: questionResource({ question: "First question" }),
      type: "questionCreated",
    });

    expect(created.draft).toBe("A follow-up typed while waiting");
  });
});
