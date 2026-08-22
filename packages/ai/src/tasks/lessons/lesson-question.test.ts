import { generateText, streamText } from "ai";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateLessonQuestionAnswer, streamLessonQuestionAnswer } from "./lesson-question";
import type * as Ai from "ai";

const consumeStream = vi.fn();
let stream: ReadableStream;

vi.mock("server-only", () => ({}));
vi.mock("./lesson-question.prompt.md", () => ({ default: "Grounded tutor instructions" }));

// A real provider stream would spend credits, so tests mock only the third-party AI SDK boundary.
vi.mock("ai", async (importOriginal) => {
  const actual = await importOriginal<typeof Ai>();

  return { ...actual, generateText: vi.fn(), streamText: vi.fn() };
});

const contextSnapshot = {
  answer: null,
  chapter: { description: null, title: "Greetings" },
  course: { description: "Beginner German", language: "en", targetLanguage: "de", title: "German" },
  lesson: {
    description: "Use greetings in context",
    kind: "explanation",
    language: "en",
    title: "Hello and goodbye",
  },
  lessonSteps: [],
  mistake: null,
  scope: { kind: "step" as const },
  step: {
    content: { kind: "multipleChoice", question: "How do you say hello?" },
    kind: "multipleChoice",
    sentence: null,
    stepNumber: 2,
    word: { pronunciation: null, romanization: null, translation: "hello", word: "Hallo" },
  },
  version: 1 as const,
};

describe(generateLessonQuestionAnswer, () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses the selected eval model and returns the prompts with the generated answer", async () => {
    vi.mocked(generateText).mockResolvedValue({
      text: "Think about when Hallo is used during the day.",
      usage: { inputTokens: 80, outputTokens: 12, totalTokens: 92 },
    } as Awaited<ReturnType<typeof generateText>>);

    const result = await generateLessonQuestionAnswer({
      contextSnapshot,
      model: "openai/gpt-5.6-sol",
      priorTurns: [{ answer: "It is a greeting.", question: "What does Hallo mean?" }],
      question: "Can you give me a hint?",
      reasoning: "high",
      useFallback: false,
    });

    expect(generateText).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        instructions: "Grounded tutor instructions",
        maxOutputTokens: 600,
        messages: [
          { content: "What does Hallo mean?", role: "user" },
          { content: "It is a greeting.", role: "assistant" },
          { content: expect.stringContaining('"scope":{"kind":"step"}'), role: "user" },
        ],
        model: expect.objectContaining({ modelId: "openai/gpt-5.6-sol" }),
        providerOptions: {
          gateway: { models: [], order: ["openai", "azure", "google", "anthropic", "vertex"] },
        },
        reasoning: "high",
      }),
    );

    expect(result).toMatchObject({
      data: { answer: "Think about when Hallo is used during the day." },
      systemPrompt: "Grounded tutor instructions",
      usage: { inputTokens: 80, outputTokens: 12, totalTokens: 92 },
    });

    expect(result.userPrompt).toContain("What does Hallo mean?");
    expect(result.userPrompt).toContain("It is a greeting.");
    expect(result.userPrompt).toContain("Can you give me a hint?");
  });
});

describe(streamLessonQuestionAnswer, () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stream = new ReadableStream();

    vi.mocked(streamText).mockReturnValue({ consumeStream, stream } as unknown as ReturnType<
      typeof streamText
    >);
  });

  it("uses Luna with Flash Lite fallback and makes the frozen step the current context", () => {
    const generation = streamLessonQuestionAnswer({
      contextSnapshot,
      onEnd: vi.fn(),
      onError: vi.fn(),
      priorTurns: [{ answer: "Hallo is the standard greeting.", question: "What is Hallo?" }],
      question: "Can you give me a hint?",
    });

    expect(streamText).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        instructions: "Grounded tutor instructions",
        maxOutputTokens: 600,
        messages: [
          { content: "What is Hallo?", role: "user" },
          { content: "Hallo is the standard greeting.", role: "assistant" },
          { content: expect.stringContaining('"scope":{"kind":"step"}'), role: "user" },
        ],
        model: expect.objectContaining({ modelId: "openai/gpt-5.6-luna" }),
        providerOptions: {
          gateway: {
            models: ["google/gemini-3.1-flash-lite"],
            order: ["openai", "azure", "google", "anthropic", "vertex"],
          },
        },
        reasoning: "minimal",
      }),
    );

    const call = vi.mocked(streamText).mock.calls[0]?.[0];
    const currentMessage = call?.messages?.at(-1);

    expect(currentMessage).toMatchObject({ role: "user" });

    expect(currentMessage && "content" in currentMessage ? currentMessage.content : "").toContain(
      "Can you give me a hint?",
    );

    expect(call).not.toHaveProperty("tools");

    generation.consumeStream();
    expect(consumeStream).toHaveBeenCalledExactlyOnceWith();
  });

  it("reports the routed fallback model and usage from the completed stream", async () => {
    const onEnd = vi.fn();

    streamLessonQuestionAnswer({
      contextSnapshot: {
        ...contextSnapshot,
        mistake: {
          correctAnswer: "Hallo",
          feedback: "Use Hallo for this greeting.",
          selectedAnswer: "Guten Abend",
        },
        scope: { kind: "mistake" },
      },
      onEnd,
      onError: vi.fn(),
      priorTurns: [],
      question: "Why was my answer wrong?",
    });

    const call = vi.mocked(streamText).mock.calls[0]?.[0];

    expect(call?.messages?.at(-1)).toMatchObject({
      content: expect.stringContaining('"selectedAnswer":"Guten Abend"'),
      role: "user",
    });

    await call?.onLanguageModelCallEnd?.({
      modelId: "gemini-3.1-flash-lite",
      provider: "gateway",
    } as never);

    await call?.onEnd?.({
      finishReason: "stop",
      model: { modelId: "openai/gpt-5.6-luna", provider: "gateway" },
      text: "Guten Abend means good evening, while Hallo is the general greeting here.",
      usage: { inputTokens: 120, outputTokens: 24, totalTokens: 144 },
    } as never);

    expect(onEnd).toHaveBeenCalledExactlyOnceWith({
      answer: "Guten Abend means good evening, while Hallo is the general greeting here.",
      finishReason: "stop",
      inputTokens: 120,
      model: "google/gemini-3.1-flash-lite",
      outputTokens: 24,
      provider: "google",
      totalTokens: 144,
    });
  });

  it("rejects the raw answer body when the provider stream fails", async () => {
    const providerError = new Error("Provider unavailable");
    const failureHandling = Promise.withResolvers<true>();
    const events: string[] = [];

    const onError = vi.fn(async () => {
      events.push("failure-started");
      await failureHandling.promise;
      events.push("failure-finished");
    });

    const failedStream = new ReadableStream({
      start(controller) {
        controller.enqueue({ error: providerError, type: "error" });
        controller.close();
      },
    });

    vi.mocked(streamText).mockReturnValue({
      consumeStream,
      stream: failedStream,
    } as unknown as ReturnType<typeof streamText>);

    const generation = streamLessonQuestionAnswer({
      contextSnapshot,
      onEnd: vi.fn(),
      onError,
      priorTurns: [],
      question: "Can you help?",
    });

    const call = vi.mocked(streamText).mock.calls[0]?.[0];
    const sdkErrorPromise = call?.onError?.({ error: providerError } as never);

    const streamErrorPromise = generation.stream
      .getReader()
      .read()
      .then(
        (value) => value,
        (error: unknown) => {
          events.push("stream-failed");
          throw error;
        },
      );

    await vi.waitFor(() => expect(onError).toHaveBeenCalledExactlyOnceWith(providerError));

    expect(events).toStrictEqual(["failure-started"]);

    failureHandling.resolve(true);
    await sdkErrorPromise;

    await expect(streamErrorPromise).rejects.toBe(providerError);
    expect(events).toStrictEqual(["failure-started", "failure-finished", "stream-failed"]);
  });

  it("fails an empty provider answer so the durable question remains retryable", async () => {
    const onEnd = vi.fn();
    const onError = vi.fn();

    const emptyAnswerStream = new ReadableStream({
      start(controller) {
        controller.enqueue({
          finishReason: "stop",
          rawFinishReason: undefined,
          totalUsage: { inputTokens: 20, outputTokens: 0, totalTokens: 20 },
          type: "finish",
        });

        controller.close();
      },
    });

    vi.mocked(streamText).mockReturnValue({
      consumeStream,
      stream: emptyAnswerStream,
    } as unknown as ReturnType<typeof streamText>);

    const generation = streamLessonQuestionAnswer({
      contextSnapshot,
      onEnd,
      onError,
      priorTurns: [],
      question: "Can you help?",
    });

    const call = vi.mocked(streamText).mock.calls[0]?.[0];

    await call?.onEnd?.({
      finishReason: "stop",
      model: { modelId: "gpt-5.6-luna", provider: "openai.responses" },
      text: "   ",
      usage: { inputTokens: 20, outputTokens: 0, totalTokens: 20 },
    } as never);

    expect(onEnd).not.toHaveBeenCalled();

    expect(onError).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ message: "AI provider returned an empty lesson question answer" }),
    );

    await expect(generation.stream.getReader().read()).rejects.toThrow(
      "AI provider returned an empty lesson question answer",
    );
  });

  it("fails the response stream when the completed answer cannot be persisted", async () => {
    const persistenceError = new Error("Database unavailable");
    const onError = vi.fn();

    const completedStream = new ReadableStream({
      start(controller) {
        controller.enqueue({ id: "answer", text: "A concise answer.", type: "text-delta" });

        controller.enqueue({
          finishReason: "stop",
          rawFinishReason: undefined,
          totalUsage: { inputTokens: 20, outputTokens: 4, totalTokens: 24 },
          type: "finish",
        });

        controller.close();
      },
    });

    vi.mocked(streamText).mockReturnValue({
      consumeStream,
      stream: completedStream,
    } as unknown as ReturnType<typeof streamText>);

    const generation = streamLessonQuestionAnswer({
      contextSnapshot,
      onEnd: vi.fn().mockRejectedValue(persistenceError),
      onError,
      priorTurns: [],
      question: "Can you help?",
    });

    const call = vi.mocked(streamText).mock.calls[0]?.[0];

    await call?.onEnd?.({
      finishReason: "stop",
      model: { modelId: "openai/gpt-5.6-luna", provider: "gateway" },
      text: "A concise answer.",
      usage: { inputTokens: 20, outputTokens: 4, totalTokens: 24 },
    } as never);

    expect(onError).toHaveBeenCalledExactlyOnceWith(persistenceError);

    const reader = generation.stream.getReader();

    await expect(reader.read()).resolves.toMatchObject({ value: "A concise answer." });
    await expect(reader.read()).rejects.toBe(persistenceError);
  });
});
