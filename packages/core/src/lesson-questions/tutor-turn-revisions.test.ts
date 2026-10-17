import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { readLearnerRevision } from "../_test-utils/learner-revision";
import { mockSession } from "../_test-utils/mock-session";
import { createLessonQuestionFixture } from "./_test-utils/create-question";
import {
  claimLessonQuestionAnswer,
  completeLessonQuestionAnswer,
  failLessonQuestionAnswer,
} from "./answer-lifecycle";
import { createLessonQuestion } from "./create-lesson-question";

const ANSWER = {
  answer: "Because it builds on the last screen.",
  finishReason: "stop",
  generatedAt: "2026-09-27T12:00:00.000Z",
  model: "openai/gpt-6-luna",
  promptVersion: "lesson-question-test",
  provider: "openai",
  runId: "run-tutor-turn-revisions",
};

function claim(questionId: string) {
  return claimLessonQuestionAnswer({ questionId, requestedModel: "openai/gpt-6-luna" });
}

async function claimed(questionId: string) {
  const result = await claim(questionId);

  if (result.status !== "ready") {
    throw new Error(`Expected a ready claim, received ${result.status}`);
  }

  return result.claim;
}

describe("tutor turn revisions", () => {
  it("raises the revision once for a new question, and not for its retry or a blocked one", async () => {
    const { lesson, question, user } = await createLessonQuestionFixture();

    // The thread shows the question as soon as it's asked.
    await expect(readLearnerRevision(user.id)).resolves.toBe(1n);

    await prisma.lessonQuestion.update({
      data: { answer: "Answered", status: "completed" },
      where: { id: question.id },
    });

    const ask = (input: { question: string; requestId: string }) =>
      createLessonQuestion({
        input: { context: { kind: "lesson" }, ...input },
        target: { kind: "lesson", lessonId: lesson.id },
      });

    const followUp = { question: "And then?", requestId: randomUUID() };

    await expect(ask(followUp)).resolves.toMatchObject({ status: "created" });
    await expect(readLearnerRevision(user.id)).resolves.toBe(2n);

    // A retried request returns the same question.
    await expect(ask(followUp)).resolves.toMatchObject({ status: "created" });

    // The follow-up isn't answered yet, so another question on the lesson waits.
    await expect(ask({ question: "Why?", requestId: randomUUID() })).resolves.toStrictEqual({
      status: "conflict",
    });

    await expect(readLearnerRevision(user.id)).resolves.toBe(2n);
  });

  it("raises it for each answer state the thread shows, and not for a stale or lost one", async () => {
    const { question, user } = await createLessonQuestionFixture();
    const asked = await readLearnerRevision(user.id);

    const first = await claimed(question.id);

    // Writing starts (+1) and takes one tutor message from the allowance (+1).
    await expect(readLearnerRevision(user.id)).resolves.toBe(asked + 2n);

    // A second claim while the first one writes is refused, and changes nothing.
    await expect(claim(question.id)).resolves.toStrictEqual({ status: "conflict" });
    await expect(readLearnerRevision(user.id)).resolves.toBe(asked + 2n);

    await expect(
      failLessonQuestionAnswer({ questionId: question.id, revision: first.revision }),
    ).resolves.toStrictEqual({ status: "updated" });

    await expect(readLearnerRevision(user.id)).resolves.toBe(asked + 3n);

    await expect(
      failLessonQuestionAnswer({ questionId: question.id, revision: first.revision }),
    ).resolves.toStrictEqual({ status: "stale" });

    // The retry writes again without counting the message twice.
    const retry = await claimed(question.id);
    await expect(readLearnerRevision(user.id)).resolves.toBe(asked + 4n);

    await expect(
      completeLessonQuestionAnswer({
        ...ANSWER,
        questionId: question.id,
        revision: first.revision,
      }),
    ).resolves.toStrictEqual({ status: "stale" });

    await expect(readLearnerRevision(user.id)).resolves.toBe(asked + 4n);

    await expect(
      completeLessonQuestionAnswer({
        ...ANSWER,
        questionId: question.id,
        revision: retry.revision,
      }),
    ).resolves.toStrictEqual({ status: "updated" });

    await expect(readLearnerRevision(user.id)).resolves.toBe(asked + 5n);
  });

  it("leaves another learner's revision alone when they try someone else's question", async () => {
    const { question } = await createLessonQuestionFixture();
    const other = await userFixture();
    mockSession(other.id);

    await expect(claim(question.id)).resolves.toStrictEqual({ status: "notFound" });

    await expect(
      failLessonQuestionAnswer({ questionId: question.id, revision: 1 }),
    ).resolves.toStrictEqual({ status: "notFound" });

    await expect(readLearnerRevision(other.id)).resolves.toBe(0n);
  });
});
