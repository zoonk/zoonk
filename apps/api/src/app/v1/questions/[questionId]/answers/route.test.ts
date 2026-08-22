import { trackGenerationRateLimited } from "@/lib/server-track-events";
import {
  type LessonQuestionAnswerCompletion,
  streamLessonQuestionAnswer,
} from "@zoonk/ai/tasks/lessons/question";
import {
  claimLessonQuestionAnswer,
  completeLessonQuestionAnswer,
} from "@zoonk/core/lesson-questions/answer-lifecycle";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST as postAnswer } from "./route";

vi.mock("@zoonk/ai/tasks/lessons/question", () => ({
  LESSON_QUESTION_MODEL: "openai/gpt-5.6-luna",
  streamLessonQuestionAnswer: vi.fn(),
}));

// Core integration tests own the conditional database writes. This adapter test injects their
// explicit outcomes so every persistence race is covered without spending credits on a provider.
vi.mock("@zoonk/core/lesson-questions/answer-lifecycle", () => ({
  claimLessonQuestionAnswer: vi.fn(),
  completeLessonQuestionAnswer: vi.fn(),
  failLessonQuestionAnswer: vi.fn(),
}));

vi.mock("@zoonk/utils/logger", () => ({ logError: vi.fn() }));
vi.mock("@/lib/server-track-events", () => ({ trackGenerationRateLimited: vi.fn() }));

const QUESTION_ID = "019c9bd7-bf11-73cb-9cc8-fe371298190b";
const consumeStream = vi.fn();

const completion: LessonQuestionAnswerCompletion = {
  answer: "A grounded answer",
  finishReason: "stop",
  model: "openai/gpt-5.6-luna",
  provider: "openai",
};

type StreamInput = Parameters<typeof streamLessonQuestionAnswer>[0];

async function createAnswerResponse(): Promise<{ input: StreamInput; response: Response }> {
  const response = await postAnswer(
    new Request(`http://localhost/v1/questions/${QUESTION_ID}/answers`),
    { params: Promise.resolve({ questionId: QUESTION_ID }) },
  );

  const input = vi.mocked(streamLessonQuestionAnswer).mock.calls[0]?.[0];

  if (!input) {
    throw new Error("Expected answer generation to start");
  }

  return { input, response };
}

describe("lesson question answer route", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(claimLessonQuestionAnswer).mockResolvedValue({
      claim: {
        contextSnapshot: {},
        priorTurns: [],
        question: "Can you explain this?",
        questionId: QUESTION_ID,
        revision: 1,
      },
      status: "ready",
    } as never);

    // The provider cannot be called deterministically in adapter tests, so the narrow AI stream
    // boundary is replaced while the route-owned persistence callbacks remain real.
    vi.mocked(streamLessonQuestionAnswer).mockImplementation(() => ({
      consumeStream,
      stream: new ReadableStream<string>({ start: (controller) => controller.close() }),
    }));
  });

  it("accepts the stream only after the claimed revision is persisted", async () => {
    vi.mocked(completeLessonQuestionAnswer).mockResolvedValue({ status: "updated" });
    const { input, response } = await createAnswerResponse();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("content-type")).toBe("text/plain; charset=utf-8");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(consumeStream).toHaveBeenCalledExactlyOnceWith();
    await expect(Promise.resolve(input.onEnd(completion))).resolves.toBeUndefined();

    expect(completeLessonQuestionAnswer).toHaveBeenCalledExactlyOnceWith({
      ...completion,
      questionId: QUESTION_ID,
      revision: 1,
    });
  });

  it("returns the stable generation limit response without starting the provider", async () => {
    const actor = { distinctId: "learner-id", username: "learner" };

    const limit = {
      period: "day" as const,
      resource: "lessonQuestion" as const,
      viewer: "authenticated" as const,
    };

    vi.mocked(claimLessonQuestionAnswer).mockResolvedValue({
      actor,
      limit,
      status: "limitReached",
    });

    const response = await postAnswer(
      new Request(`http://localhost/v1/questions/${QUESTION_ID}/answers`),
      { params: Promise.resolve({ questionId: QUESTION_ID }) },
    );

    expect(response.status).toBe(429);

    await expect(response.json()).resolves.toStrictEqual({
      error: {
        code: "GENERATION_LIMIT_REACHED",
        details: limit,
        message: "Generation limit reached",
      },
    });

    expect(streamLessonQuestionAnswer).not.toHaveBeenCalled();

    expect(trackGenerationRateLimited).toHaveBeenCalledExactlyOnceWith({
      actor,
      limit,
      target: { questionId: QUESTION_ID },
    });
  });

  it.each(["notFound", "stale", "unauthorized"] as const)(
    "rejects the stream when completion persistence returns %s",
    async (status) => {
      vi.mocked(completeLessonQuestionAnswer).mockResolvedValue({ status });
      const { input } = await createAnswerResponse();

      await expect(Promise.resolve(input.onEnd(completion))).rejects.toThrow(
        `Lesson question answer was not persisted: ${status}`,
      );
    },
  );
});
