import { type LessonQuestionResource } from "@zoonk/core/lesson-questions/contract";
import { describe, expect, it } from "vitest";
import {
  doesLessonQuestionBlockNewQuestion,
  isLessonQuestionAnswerInProgress,
} from "./lesson-question-status";

function questionResource(status: LessonQuestionResource["status"]): LessonQuestionResource {
  return {
    answer: null,
    context: { kind: "lesson" },
    createdAt: "2026-08-21T12:00:00.000Z",
    id: "0198ca70-9c50-7000-8000-000000000001",
    question: "How does this work?",
    status,
    updatedAt: "2026-08-21T12:00:00.000Z",
  };
}

describe("lesson question status", () => {
  it("keeps failed answers retryable while blocking a new question", () => {
    const failedQuestion = questionResource("failed");

    expect(isLessonQuestionAnswerInProgress(failedQuestion)).toBe(false);
    expect(doesLessonQuestionBlockNewQuestion(failedQuestion)).toBe(true);
  });

  it("stops blocking the composer after an answer completes", () => {
    const completedQuestion = questionResource("completed");

    expect(isLessonQuestionAnswerInProgress(completedQuestion)).toBe(false);
    expect(doesLessonQuestionBlockNewQuestion(completedQuestion)).toBe(false);
  });

  it.each(["pending", "running"] as const)("treats %s answers as in progress", (status) => {
    const question = questionResource(status);

    expect(isLessonQuestionAnswerInProgress(question)).toBe(true);
    expect(doesLessonQuestionBlockNewQuestion(question)).toBe(true);
  });
});
