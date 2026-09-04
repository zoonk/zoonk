import { trackGenerationRateLimited } from "@/lib/server-track-events";
import { streamLessonQuestionAnswer } from "@zoonk/ai/tasks/lessons/question";
import {
  claimLessonQuestionAnswer,
  completeLessonQuestionAnswer,
  failLessonQuestionAnswer,
} from "@zoonk/core/lesson-questions/answer-lifecycle";
import { logError } from "@zoonk/utils/logger";
import { simulateReadableStream, streamText } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import { after } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST as postAnswer } from "./route";
import type * as LessonQuestionModule from "@zoonk/ai/tasks/lessons/question";
import type * as NextServer from "next/server";

vi.mock("@zoonk/ai/tasks/lessons/question", async (importOriginal) => ({
  ...(await importOriginal<typeof LessonQuestionModule>()),
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

vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof NextServer>()),
  after: vi.fn(),
}));

const QUESTION_ID = "019c9bd7-bf11-73cb-9cc8-fe371298190b";
const ANSWER = "A grounded answer";
const EMPTY_ANSWER_MESSAGE = "AI provider returned an empty lesson question answer";
const afterTasks: Promise<unknown>[] = [];

const successfulProviderStream: MockLanguageModelV4["doStream"] = async () => ({
  stream: simulateReadableStream({
    chunks: [
      {
        id: "response-id",
        modelId: "openai/gpt-5.6-luna",
        timestamp: new Date("2026-09-04T12:00:00.000Z"),
        type: "response-metadata",
      },
      { id: "answer", type: "text-start" },
      { delta: ANSWER, id: "answer", type: "text-delta" },
      { id: "answer", type: "text-end" },
      {
        finishReason: { raw: undefined, unified: "stop" },
        type: "finish",
        usage: {
          inputTokens: { cacheRead: undefined, cacheWrite: undefined, noCache: 80, total: 80 },
          outputTokens: { reasoning: undefined, text: 12, total: 12 },
        },
      },
    ],
  }),
});

function createTestGeneration(
  doStream: MockLanguageModelV4["doStream"] = successfulProviderStream,
) {
  return streamText({
    model: new MockLanguageModelV4({
      doStream,
      modelId: "openai/gpt-5.6-luna",
      provider: "gateway",
    }),
    onError: vi.fn(),
    prompt: "Test lesson question",
  });
}

async function createAnswerResponse() {
  return postAnswer(new Request(`http://localhost/v1/questions/${QUESTION_ID}/answers`), {
    params: Promise.resolve({ questionId: QUESTION_ID }),
  });
}

describe("lesson question answer route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    afterTasks.length = 0;

    vi.mocked(after).mockImplementation((task) => {
      afterTasks.push(Promise.resolve(typeof task === "function" ? task() : task));
    });

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

    // The route uses a real AI SDK stream with only the external model boundary replaced.
    vi.mocked(streamLessonQuestionAnswer).mockImplementation(() => createTestGeneration());
    vi.mocked(completeLessonQuestionAnswer).mockResolvedValue({ status: "updated" });
  });

  it("streams UI message events and persists the completed answer", async () => {
    const response = await createAnswerResponse();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("content-type")).toBe("text/event-stream");
    expect(response.headers.get("x-vercel-ai-ui-message-stream")).toBe("v1");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(after).toHaveBeenCalledOnce();

    const body = await response.text();
    await Promise.all(afterTasks);

    expect(body).toContain(`"delta":"${ANSWER}"`);
    expect(body).toContain("data: [DONE]");

    expect(completeLessonQuestionAnswer).toHaveBeenCalledExactlyOnceWith({
      answer: ANSWER,
      finishReason: "stop",
      inputTokens: 80,
      model: "openai/gpt-5.6-luna",
      outputTokens: 12,
      provider: "openai",
      questionId: QUESTION_ID,
      revision: 1,
      totalTokens: 92,
    });
  });

  it("finishes persistence after the response stream is canceled", async () => {
    const continueGeneration = Promise.withResolvers<null>();

    const controlledProviderStream: MockLanguageModelV4["doStream"] = async () => ({
      stream: new ReadableStream({
        start(controller) {
          controller.enqueue({ id: "answer", type: "text-start" });
          controller.enqueue({ delta: "Partial answer", id: "answer", type: "text-delta" });

          void continueGeneration.promise.then(() => {
            controller.enqueue({ delta: " completed", id: "answer", type: "text-delta" });
            controller.enqueue({ id: "answer", type: "text-end" });

            controller.enqueue({
              finishReason: { raw: undefined, unified: "stop" },
              type: "finish",
              usage: {
                inputTokens: {
                  cacheRead: undefined,
                  cacheWrite: undefined,
                  noCache: 10,
                  total: 10,
                },
                outputTokens: { reasoning: undefined, text: 4, total: 4 },
              },
            });

            controller.close();
          });
        },
      }),
    });

    vi.mocked(streamLessonQuestionAnswer).mockImplementation(() =>
      createTestGeneration(controlledProviderStream),
    );

    const response = await createAnswerResponse();
    const reader = response.body?.getReader();

    if (!reader) {
      throw new Error("Expected a streamed answer body");
    }

    await reader.read();
    await reader.cancel();

    expect(completeLessonQuestionAnswer).not.toHaveBeenCalled();

    continueGeneration.resolve(null);
    await Promise.all(afterTasks);

    expect(completeLessonQuestionAnswer).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        answer: "Partial answer completed",
        questionId: QUESTION_ID,
        revision: 1,
      }),
    );
  });

  it("marks an exhausted provider failure as retryable without logging request content", async () => {
    const providerError = Object.assign(new Error("Provider failed"), {
      requestBodyValues: { prompt: "private lesson and learner question" },
    });

    const failedProviderStream: MockLanguageModelV4["doStream"] = async () => ({
      stream: simulateReadableStream({ chunks: [{ error: providerError, type: "error" }] }),
    });

    vi.mocked(streamLessonQuestionAnswer).mockImplementation(() =>
      createTestGeneration(failedProviderStream),
    );

    const response = await createAnswerResponse();

    await expect(response.text()).rejects.toThrow(EMPTY_ANSWER_MESSAGE);
    await Promise.all(afterTasks);

    expect(logError).toHaveBeenCalledExactlyOnceWith("[Lesson Question Answer Error]", {
      questionId: QUESTION_ID,
      revision: 1,
    });

    expect(logError).not.toHaveBeenCalledWith(expect.anything(), providerError);

    expect(failLessonQuestionAnswer).toHaveBeenCalledExactlyOnceWith({
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

    const response = await createAnswerResponse();

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
    "marks the answer retryable when completion persistence returns %s",
    async (status) => {
      vi.mocked(completeLessonQuestionAnswer).mockResolvedValue({ status });
      const response = await createAnswerResponse();

      await expect(response.text()).rejects.toThrow(
        `Lesson question answer was not persisted: ${status}`,
      );

      await Promise.all(afterTasks);

      expect(failLessonQuestionAnswer).toHaveBeenCalledExactlyOnceWith({
        questionId: QUESTION_ID,
        revision: 1,
      });
    },
  );
});
