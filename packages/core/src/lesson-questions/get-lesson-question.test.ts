import { prisma } from "@zoonk/db";
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

  it("requires a current subscription", async () => {
    const { question, user } = await createLessonQuestionFixture();

    await prisma.subscription.updateMany({
      data: { status: "canceled" },
      where: { referenceId: user.id },
    });

    await expect(getLessonQuestion({ questionId: question.id })).resolves.toStrictEqual({
      status: "subscriptionRequired",
    });
  });

  it("does not expose another subscriber's question", async () => {
    const { question } = await createLessonQuestionFixture();
    const otherUser = await userFixture();

    await prisma.subscription.create({
      data: { plan: "plus", provider: "zoonk", referenceId: otherUser.id, status: "active" },
    });

    mockSession(otherUser.id);

    await expect(getLessonQuestion({ questionId: question.id })).resolves.toStrictEqual({
      status: "notFound",
    });
  });
});
