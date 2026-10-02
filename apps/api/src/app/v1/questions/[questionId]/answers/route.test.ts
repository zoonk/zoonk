import { streamLessonQuestionAnswer } from "@zoonk/ai/tasks/lessons/question";
import {
  claimLessonQuestionAnswer,
  completeLessonQuestionAnswer,
  failLessonQuestionAnswer,
  rememberLessonQuestionAnswer,
} from "@zoonk/core/lesson-questions/answer-lifecycle";
import { type MemoryChange } from "@zoonk/core/memory/contract";
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
  rememberLessonQuestionAnswer: vi.fn(),
}));

vi.mock("@zoonk/utils/logger", () => ({ logError: vi.fn() }));

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
        modelId: "openai/gpt-6-luna",
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

/** The run that answered: a fallback model, as AI Gateway's routing reports it. */
const PROVENANCE = {
  generatedAt: "2026-09-04T12:00:01.000Z",
  latencyMs: 900,
  model: "anthropic/claude-haiku-4.5",
  promptVersion: "prompt-version-test",
  provider: "anthropic",
  requestedModel: "openai/gpt-6-luna",
  runId: "run-answer-test",
  usage: {},
};

function createTestGeneration(
  doStream: MockLanguageModelV4["doStream"] = successfulProviderStream,
) {
  const generation = streamText({
    model: new MockLanguageModelV4({ doStream, modelId: "openai/gpt-6-luna", provider: "gateway" }),
    onError: vi.fn(),
    prompt: "Test lesson question",
  });

  return { generation, provenance: Promise.resolve(PROVENANCE) };
}

/** Reads the streamed body until `text` has arrived, and returns what was read. */
async function readUntil({
  read = "",
  reader,
  text,
}: {
  read?: string;
  reader: ReadableStreamDefaultReader<string>;
  text: string;
}): Promise<string> {
  if (read.includes(text)) {
    return read;
  }

  const { done, value } = await reader.read();

  if (done) {
    throw new Error(`The stream ended before ${text}`);
  }

  return readUntil({ read: read + value, reader, text });
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
        learnerMemory: [],
        priorTurns: [],
        question: "Can you explain this?",
        questionId: QUESTION_ID,
        revision: 1,
        shareAnswer: false,
      },
      status: "ready",
    } as never);

    // The route uses a real AI SDK stream with only the external model boundary replaced.
    vi.mocked(streamLessonQuestionAnswer).mockImplementation(() => createTestGeneration());

    vi.mocked(completeLessonQuestionAnswer).mockResolvedValue({ status: "updated" });
    vi.mocked(rememberLessonQuestionAnswer).mockResolvedValue([]);
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
      generatedAt: PROVENANCE.generatedAt,
      inputTokens: 80,
      model: PROVENANCE.model,
      outputTokens: 12,
      promptVersion: PROVENANCE.promptVersion,
      provider: PROVENANCE.provider,
      questionId: QUESTION_ID,
      revision: 1,
      runId: PROVENANCE.runId,
      shareAnswer: false,
      totalTokens: 92,
    });
  });

  it("writes a shared answer without the learner's memory and saves it for everyone", async () => {
    vi.mocked(claimLessonQuestionAnswer).mockResolvedValue({
      claim: {
        contextSnapshot: {},
        learnerMemory: [],
        priorTurns: [],
        question: "Explain this more simply",
        questionId: QUESTION_ID,
        revision: 1,
        shareAnswer: true,
      },
      status: "ready",
    } as never);

    const response = await createAnswerResponse();
    await response.text();
    await Promise.all(afterTasks);

    expect(streamLessonQuestionAnswer).toHaveBeenCalledWith(
      expect.objectContaining({ analytics: { contentScope: "shared" }, learnerMemory: [] }),
    );

    expect(completeLessonQuestionAnswer).toHaveBeenCalledWith(
      expect.objectContaining({ questionId: QUESTION_ID, shareAnswer: true }),
    );

    expect(rememberLessonQuestionAnswer).not.toHaveBeenCalled();
  });

  it("finishes the answer once it's saved, then sends what it changed in memory", async () => {
    const fact = {
      category: "goals" as const,
      confidence: 0.9,
      createdAt: new Date("2026-09-04T12:00:00.000Z"),
      expiresAt: null,
      id: "019c9bd7-bf11-73cb-9cc8-fe371298190c",
      origin: "said" as const,
      sensitive: false,
      source: { id: QUESTION_ID, kind: "chat" as const },
      statement: "Preparing for a nursing exam",
      updatedAt: new Date("2026-09-04T12:00:00.000Z"),
    };

    const saving = Promise.withResolvers<null>();
    const memory = Promise.withResolvers<MemoryChange[]>();
    const order: string[] = [];

    vi.mocked(completeLessonQuestionAnswer).mockImplementation(async () => {
      await saving.promise;
      order.push("saved");
      return { status: "updated" };
    });

    vi.mocked(rememberLessonQuestionAnswer).mockReturnValue(memory.promise);

    const response = await createAnswerResponse();
    const reader = response.body?.pipeThrough(new TextDecoderStream()).getReader();

    if (!reader) {
      throw new Error("Expected a streamed answer body");
    }

    const reading = readUntil({ reader, text: '"type":"finish"' }).then((read) => {
      order.push("finish");
      return read;
    });

    await vi.waitFor(() => expect(completeLessonQuestionAnswer).toHaveBeenCalledOnce());
    saving.resolve(null);

    // The answer is done once it's saved: `finish` follows the save, while memory still learns.
    await expect(reading).resolves.toContain(`"delta":"${ANSWER}"`);
    expect(order).toStrictEqual(["saved", "finish"]);

    expect(rememberLessonQuestionAnswer).toHaveBeenCalledExactlyOnceWith({
      questionId: QUESTION_ID,
    });

    memory.resolve([{ action: "added", fact, previous: null }]);

    const afterFinish = await readUntil({ reader, text: "[DONE]" });
    await Promise.all(afterTasks);

    expect(afterFinish).toContain('"type":"data-memory"');
    expect(afterFinish).toContain('"statement":"Preparing for a nursing exam"');
  });

  it("keeps a saved answer done when memory can't learn from it", async () => {
    vi.mocked(rememberLessonQuestionAnswer).mockRejectedValue(new Error("Session store down"));

    const response = await createAnswerResponse();
    const body = await response.text();
    await Promise.all(afterTasks);

    expect(body).toContain('"type":"finish"');
    expect(body).toContain("data: [DONE]");
    expect(body).not.toContain('"type":"data-memory"');
    expect(failLessonQuestionAnswer).not.toHaveBeenCalled();

    expect(logError).toHaveBeenCalledExactlyOnceWith("[Lesson Question Memory Error]", {
      questionId: QUESTION_ID,
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
