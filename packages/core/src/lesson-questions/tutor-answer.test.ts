import {
  LESSON_QUESTION_MODEL,
  streamLessonQuestionAnswer,
} from "@zoonk/ai/tasks/lessons/question";
import { prisma } from "@zoonk/db";
import { memoryFactFixture } from "@zoonk/testing/fixtures/memory";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toMemoryFactView } from "../memory/_utils/memory-fact-view";
import { updateMemoryFromActivity } from "../memory/update-memory-from-activity";
import { createLessonQuestionFixture } from "./_test-utils/create-question";
import { claimLessonQuestionAnswer } from "./answer-lifecycle";
import { finishTutorAnswer, rememberTutorAnswer, startTutorAnswer } from "./tutor-answer";
import type * as LessonQuestionTask from "@zoonk/ai/tasks/lessons/question";

vi.mock("@zoonk/ai/tasks/lessons/question", async (importOriginal) => ({
  ...(await importOriginal<typeof LessonQuestionTask>()),
  streamLessonQuestionAnswer: vi.fn(),
}));

vi.mock("../memory/update-memory-from-activity", () => ({ updateMemoryFromActivity: vi.fn() }));

const PROVENANCE = {
  generatedAt: "2026-10-30T12:00:00.000Z",
  model: "openai/gpt-6-luna",
  promptVersion: "lesson-question-test",
  provider: "openai",
  runId: "run-tutor-answer-test",
};

function mockAnswer({ finishReason = "stop", text }: { finishReason?: string; text: string }) {
  vi.mocked(streamLessonQuestionAnswer).mockReturnValue({
    generation: {
      finalStep: Promise.resolve({ finishReason, text }),
      steps: Promise.resolve([{ text }]),
      stream: new ReadableStream(),
    },
    provenance: Promise.resolve(PROVENANCE),
  } as never);
}

async function startClaimedAnswer() {
  const { question, user } = await createLessonQuestionFixture();
  const claimed = await claimLessonQuestionAnswer({ questionId: question.id });

  if (claimed.status !== "ready") {
    throw new Error(`Expected a claimed answer, received ${claimed.status}`);
  }

  return { questionId: question.id, run: startTutorAnswer(claimed.claim), user };
}

function readQuestion(id: string) {
  return prisma.lessonQuestion.findUniqueOrThrow({ where: { id } });
}

describe("the tutor's answer", () => {
  beforeEach(() => {
    vi.mocked(updateMemoryFromActivity).mockResolvedValue([]);
  });

  it("saves a finished answer with only its web links, then learns memory from it", async () => {
    mockAnswer({ text: "See [your plan](/plan) and [the source](https://example.com)." });
    const { questionId, run, user } = await startClaimedAnswer();

    await expect(readQuestion(questionId)).resolves.toMatchObject({
      requestedModel: LESSON_QUESTION_MODEL,
      status: "running",
    });

    await expect(finishTutorAnswer({ confirmation: null, run })).resolves.toStrictEqual({
      confirmation: null,
      saved: "See your plan and [the source](https://example.com).",
    });

    expect(updateMemoryFromActivity).not.toHaveBeenCalled();

    await expect(readQuestion(questionId)).resolves.toMatchObject({
      answer: "See your plan and [the source](https://example.com).",
      model: PROVENANCE.model,
      runId: PROVENANCE.runId,
      status: "completed",
    });

    const fact = toMemoryFactView(
      await memoryFactFixture({ statement: "Studies for a nursing exam", userId: user.id }),
    );

    const change = { action: "added" as const, fact, previous: null };
    vi.mocked(updateMemoryFromActivity).mockResolvedValue([change]);

    await expect(rememberTutorAnswer(run.target)).resolves.toStrictEqual([change]);

    expect(updateMemoryFromActivity).toHaveBeenCalledExactlyOnceWith({
      source: expect.objectContaining({
        id: questionId,
        kind: "chat",
        messages: [
          { role: "learner", text: "How does this connect?" },
          { role: "tutor", text: "See your plan and [the source](https://example.com)." },
        ],
      }),
      userId: user.id,
    });
  });

  it("marks a failed answer failed, so the learner can ask again", async () => {
    mockAnswer({ finishReason: "error", text: "" });
    const { questionId, run } = await startClaimedAnswer();

    await expect(finishTutorAnswer({ confirmation: null, run })).rejects.toThrow(
      "AI provider returned an empty lesson question answer",
    );

    await expect(readQuestion(questionId)).resolves.toMatchObject({
      answer: null,
      status: "failed",
    });
  });

  it("saves the confirmation only when the answer has no words of its own", async () => {
    mockAnswer({ text: "" });
    const { questionId, run } = await startClaimedAnswer();
    const confirmation = "Below is your week in review.";

    await expect(finishTutorAnswer({ confirmation, run })).resolves.toStrictEqual({
      confirmation,
      saved: confirmation,
    });

    await expect(readQuestion(questionId)).resolves.toMatchObject({
      answer: confirmation,
      status: "completed",
    });
  });
});
