import { userFixture } from "@zoonk/testing/fixtures/users";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { createLessonQuestionFixture } from "./_test-utils/create-question";
import { getLessonQuestion } from "./get-lesson-question";

vi.mock("../users/get-session", () => ({ getSession: vi.fn() }));

describe(getLessonQuestion, () => {
  beforeEach(() => {
    mockSession(null);
  });

  it("returns the compact owned question resource", async () => {
    const { question } = await createLessonQuestionFixture();

    await expect(getLessonQuestion({ questionId: question.id })).resolves.toMatchObject({
      question: { context: { kind: "lesson" }, id: question.id, status: "pending" },
      status: "ready",
    });
  });

  it("does not expose another learner's question", async () => {
    const { question } = await createLessonQuestionFixture();
    const otherUser = await userFixture();

    mockSession(otherUser.id);

    await expect(getLessonQuestion({ questionId: question.id })).resolves.toStrictEqual({
      status: "notFound",
    });
  });
});
