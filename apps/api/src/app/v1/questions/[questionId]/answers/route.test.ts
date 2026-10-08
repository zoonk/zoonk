import { streamLessonQuestionAnswer } from "@zoonk/ai/tasks/lessons/question";
import { GOAL_TUTOR_MODEL, streamGoalTutorAnswer } from "@zoonk/ai/tasks/v2/tutor/goal-tutor";
import { GOAL_TUTOR_APP_TOOLS } from "@zoonk/ai/tasks/v2/tutor/goal-tutor-tools";
import {
  claimLessonQuestionAnswer,
  completeLessonQuestionAnswer,
  failLessonQuestionAnswer,
  rememberLessonQuestionAnswer,
} from "@zoonk/core/lesson-questions/answer-lifecycle";
import { offerTutorTool } from "@zoonk/core/lesson-questions/offer-tool";
import { proposeTutorPlanChange } from "@zoonk/core/lesson-questions/propose-plan-change";
import { type MemoryChange } from "@zoonk/core/memory/contract";
import { type PlanChangeView } from "@zoonk/core/plans/view-contract";
import { logError } from "@zoonk/utils/logger";
import { isStepCount, simulateReadableStream, streamText, tool } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import { after } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { POST as postAnswer } from "./route";
import type * as LessonQuestionModule from "@zoonk/ai/tasks/lessons/question";
import type * as GoalTutorModule from "@zoonk/ai/tasks/v2/tutor/goal-tutor";
import type * as NextServer from "next/server";

vi.mock("@zoonk/ai/tasks/lessons/question", async (importOriginal) => ({
  ...(await importOriginal<typeof LessonQuestionModule>()),
  streamLessonQuestionAnswer: vi.fn(),
}));

vi.mock("@zoonk/ai/tasks/v2/tutor/goal-tutor", async (importOriginal) => ({
  ...(await importOriginal<typeof GoalTutorModule>()),
  streamGoalTutorAnswer: vi.fn(),
}));

vi.mock("@zoonk/core/lesson-questions/propose-plan-change", () => ({
  proposeTutorPlanChange: vi.fn(),
}));

vi.mock("@zoonk/core/lesson-questions/offer-tool", () => ({ offerTutorTool: vi.fn() }));

/** The source words, filled in: the catalogs' translations aren't what this adapter test checks. */
vi.mock("next-intl/server", () => ({
  getExtracted:
    async () =>
    (message: string, values: Record<string, string> = {}) =>
      message.replaceAll(/\{(?<name>\w+)\}/gu, (_, name: string) => values[name] ?? ""),
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
const USER_ID = "019c9bd7-bf11-73cb-9cc8-fe3712981901";
const GOAL_ID = "019c9bd7-bf11-73cb-9cc8-fe3712981902";
const REPLACED_CHANGE_ID = "019c9bd7-bf11-73cb-9cc8-fe3712981903";
const LESSON_SNAPSHOT = { scope: { kind: "lesson" } };
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

/** What the buddy proposed in the conversation, as core saved it. */
const PROPOSED_CHANGE: PlanChangeView = {
  behind: null,
  canUndo: false,
  createdAt: "2026-09-04T12:00:00.000Z",
  days: null,
  effect: {
    endDateAfter: "2026-12-01",
    endDateBefore: "2026-11-20",
    lessonsAdded: 0,
    lessonsRemoved: 0,
  },
  id: "019c9bd7-bf11-73cb-9cc8-fe371298190d",
  kind: "edited",
  lessonsSkipped: 0,
  officialDate: null,
  operations: [{ kind: "setWeekdayMinutes", minutes: 0, weekdays: [6] }],
  reason: "Saturdays are off.",
  seen: false,
  source: "planEdit",
  status: "proposed",
  todaySession: null,
};

const STEP_USAGE = {
  inputTokens: { cacheRead: undefined, cacheWrite: undefined, noCache: 50, total: 50 },
  outputTokens: { reasoning: undefined, text: 6, total: 6 },
};

type ProviderStreamPart =
  Awaited<ReturnType<MockLanguageModelV4["doStream"]>>["stream"] extends ReadableStream<infer Part>
    ? Part
    : never;

/** The chapter test the buddy offered, as core saved it with the answer. */
const OFFERED_TEST = {
  chapterId: "019c9bd7-bf11-73cb-9cc8-fe371298190e",
  chapterTitle: "Citações diretas e autoria",
  goalId: "019c9bd7-bf11-73cb-9cc8-fe371298190f",
  kind: "chapterTest" as const,
  lessonsLeft: 6,
};

/** Choosing a mock exam the buddy offered, as core saved it with the answer. */
const OFFERED_MOCK = {
  access: "open" as const,
  goalId: "019c9bd7-bf11-73cb-9cc8-fe371298190f",
  kind: "mockExam" as const,
  subjects: ["Matemática"],
};

/** The buddy offers a mock exam in its first step, as the model would. */
const MOCK_CALL: ProviderStreamPart = {
  input: JSON.stringify({ area: null, goal: null, tool: "mockExam", topic: null }),
  toolCallId: "call-mock",
  toolName: "offerAppTool",
  type: "tool-call",
};

/** The second step's words, as the model writes them after its tools. */
const SECOND_STEP_WORDS: ProviderStreamPart[] = [
  { id: "answer", type: "text-start" as const },
  { delta: "Tap Apply to free your Saturdays.", id: "answer", type: "text-delta" as const },
  { id: "answer", type: "text-end" as const },
];

/** The buddy's first step asks for a change and offers a chapter's test, as the model would. */
const CHANGE_AND_TEST_CALLS: ProviderStreamPart[] = [
  {
    input: JSON.stringify({ request: "No study on Saturdays" }),
    toolCallId: "call-1",
    toolName: "proposePlanChange",
    type: "tool-call",
  },
  {
    input: JSON.stringify({ area: "Língua Inglesa", goal: null, tool: "chapterTest", topic: null }),
    toolCallId: "call-2",
    toolName: "offerAppTool",
    type: "tool-call",
  },
];

/**
 * The buddy calls its tools in a first step (a change and a chapter's test unless `calls` says
 * otherwise), then answers in a second, as the model would; `silent`, it writes no words in
 * either step, as Gemini once did.
 */
function createGoalTutorGeneration({
  calls = CHANGE_AND_TEST_CALLS,
  offerAppTool,
  proposePlanChange,
  silent = false,
}: Parameters<typeof streamGoalTutorAnswer>[0] & {
  calls?: ProviderStreamPart[];
  silent?: boolean;
}) {
  const steps: ProviderStreamPart[][] = [
    [
      ...(silent
        ? []
        : [
            { id: "intro", type: "text-start" as const },
            { delta: "Sure.", id: "intro", type: "text-delta" as const },
            { id: "intro", type: "text-end" as const },
          ]),
      ...calls,
      {
        finishReason: { raw: undefined, unified: "tool-calls" as const },
        type: "finish" as const,
        usage: STEP_USAGE,
      },
    ],
    [
      ...(silent ? [] : SECOND_STEP_WORDS),
      {
        finishReason: { raw: undefined, unified: "stop" as const },
        type: "finish" as const,
        usage: STEP_USAGE,
      },
    ],
  ];

  const doStream: MockLanguageModelV4["doStream"] = async () => ({
    stream: simulateReadableStream({ chunks: steps.shift() ?? [] }),
  });

  const generation = streamText({
    model: new MockLanguageModelV4({
      doStream,
      modelId: "google/gemini-3.8-flash",
      provider: "gateway",
    }),
    onError: vi.fn(),
    prompt: "No studying on Saturdays",
    stopWhen: isStepCount(2),
    tools: {
      offerAppTool: tool({
        execute: (input) => offerAppTool(input),
        inputSchema: z.object({
          area: z.string().nullable(),
          goal: z.string().nullable(),
          tool: z.enum(GOAL_TUTOR_APP_TOOLS),
          topic: z.string().nullable(),
        }),
      }),
      proposePlanChange: tool({
        execute: ({ request }) => proposePlanChange(request),
        inputSchema: z.object({ request: z.string() }),
      }),
    },
  });

  // The real stream also offers a search; this one only calls the two tools the app answers.
  return { generation, provenance: Promise.resolve(PROVENANCE) } as unknown as ReturnType<
    typeof streamGoalTutorAnswer
  >;
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
        analytics: { distinctId: USER_ID },
        contextSnapshot: LESSON_SNAPSHOT,
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
      model: PROVENANCE.model,
      promptVersion: PROVENANCE.promptVersion,
      provider: PROVENANCE.provider,
      questionId: QUESTION_ID,
      revision: 1,
      runId: PROVENANCE.runId,
      shareAnswer: false,
    });
  });

  it("writes a shared answer without the learner's memory and saves it for everyone", async () => {
    vi.mocked(claimLessonQuestionAnswer).mockResolvedValue({
      claim: {
        analytics: { distinctId: USER_ID },
        contextSnapshot: LESSON_SNAPSHOT,
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
      expect.objectContaining({
        analytics: { contentScope: "shared", distinctId: USER_ID },
        learnerMemory: [],
      }),
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

  it("streams the plan change the buddy proposed as its message's one card and saves the words of both steps", async () => {
    vi.mocked(claimLessonQuestionAnswer).mockResolvedValue({
      claim: {
        analytics: { distinctId: USER_ID, goalId: GOAL_ID },
        contextSnapshot: { scope: { kind: "plan" } },
        learnerMemory: [],
        priorTurns: [],
        question: "No studying on Saturdays",
        questionId: QUESTION_ID,
        revision: 2,
        shareAnswer: false,
      },
      status: "ready",
    } as never);

    vi.mocked(proposeTutorPlanChange).mockResolvedValue({
      cautions: [],
      change: PROPOSED_CHANGE,
      leftOut: [],
      replaced: [REPLACED_CHANGE_ID],
      status: "proposed",
    });

    vi.mocked(offerTutorTool).mockResolvedValue({ offer: OFFERED_TEST, status: "offered" });
    const modelRead: unknown[] = [];

    vi.mocked(streamGoalTutorAnswer).mockImplementation((input) =>
      createGoalTutorGeneration({
        ...input,
        offerAppTool: async (offer) => {
          const result = await input.offerAppTool(offer);
          modelRead.push(result);
          return result;
        },
        proposePlanChange: async (request) => {
          const result = await input.proposePlanChange(request);
          modelRead.push(result);
          return result;
        },
      }),
    );

    const response = await createAnswerResponse();
    const body = await response.text();
    await Promise.all(afterTasks);

    // A goal's question goes to the buddy, whose model is the one the claim records.
    expect(streamLessonQuestionAnswer).not.toHaveBeenCalled();
    const [claim] = vi.mocked(claimLessonQuestionAnswer).mock.calls[0] ?? [];
    const requested = claim?.requestedModel;
    expect(typeof requested === "function" ? requested("plan") : requested).toBe(GOAL_TUTOR_MODEL);

    // The buddy's calls count toward the learner's and the goal's AI cost.
    expect(streamGoalTutorAnswer).toHaveBeenCalledWith(
      expect.objectContaining({
        analytics: { contentScope: "personal", distinctId: USER_ID, goalId: GOAL_ID },
      }),
    );

    expect(proposeTutorPlanChange).toHaveBeenCalledExactlyOnceWith({
      questionId: QUESTION_ID,
      request: "No study on Saturdays",
      revision: 2,
    });

    // One card per message: the test the model also asked for in the same step isn't offered.
    expect(offerTutorTool).not.toHaveBeenCalled();

    // The buddy reads what the change does as the card says it, from its operations.
    expect(modelRead).toStrictEqual([
      {
        cautions: [],
        changes: "Saturday: rest day, nothing planned",
        effect: PROPOSED_CHANGE.effect,
        leftOut: [],
        officialExamDate: null,
        status: "proposed",
      },
      { reason: "onePerMessage", status: "unavailable", tool: "chapterTest" },
    ]);

    // The proposal reaches the client as a data part; the tool calls stay on the server.
    expect(body).toContain('"type":"data-plan-change"');

    // The earlier proposal it replaced says so in the conversation.
    expect(body).toContain(
      `{"data":{"ids":["${REPLACED_CHANGE_ID}"]},"type":"data-plan-changes-replaced"}`,
    );

    expect(body).not.toContain('"type":"data-tool-offer"');
    expect(body).not.toContain('"type":"tool-');
    expect(body).toContain(String.raw`"delta":"\n\n"`);

    expect(completeLessonQuestionAnswer).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        answer: "Sure.\n\nTap Apply to free your Saturdays.",
        questionId: QUESTION_ID,
        revision: 2,
      }),
    );
  });

  it("confirms in words what a buddy that only acted put under its answer, and saves it", async () => {
    vi.mocked(claimLessonQuestionAnswer).mockResolvedValue({
      claim: {
        analytics: { distinctId: USER_ID, goalId: GOAL_ID },
        contextSnapshot: { language: "en", scope: { kind: "plan" } },
        learnerMemory: [],
        priorTurns: [],
        question: "No studying on Saturdays, and is my English too basic?",
        questionId: QUESTION_ID,
        revision: 3,
        shareAnswer: false,
      },
      status: "ready",
    } as never);

    vi.mocked(proposeTutorPlanChange).mockResolvedValue({
      cautions: [],
      change: PROPOSED_CHANGE,
      leftOut: [],
      replaced: [],
      status: "proposed",
    });

    vi.mocked(offerTutorTool).mockResolvedValue({ offer: OFFERED_TEST, status: "offered" });

    vi.mocked(streamGoalTutorAnswer).mockImplementation((input) =>
      createGoalTutorGeneration({ ...input, silent: true }),
    );

    const response = await createAnswerResponse();
    const body = await response.text();
    await Promise.all(afterTasks);

    // The message's one card is the change: the test asked for beside it isn't offered.
    const confirmation =
      "I've put the change to your plan below. Nothing changes until you apply it.";

    expect(body).toContain('"type":"data-plan-change"');
    expect(body).not.toContain('"type":"data-tool-offer"');
    expect(body).toContain(JSON.stringify(confirmation).slice(1, -1));
    expect(body.indexOf("I've put the change")).toBeLessThan(body.indexOf('"type":"finish"'));
    expect(failLessonQuestionAnswer).not.toHaveBeenCalled();

    expect(completeLessonQuestionAnswer).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ answer: confirmation, questionId: QUESTION_ID, revision: 3 }),
    );
  });

  it.each([
    {
      core: { offer: OFFERED_MOCK, status: "offered" as const },
      plan: "in the learner's plan: open",
      read: { offered: { subjects: ["Matemática"] }, status: "offered", tool: "mockExam" },
      sent: true,
    },
    {
      core: {
        offer: { ...OFFERED_MOCK, access: "plusRequired" as const },
        status: "offered" as const,
      },
      plan: "not in the learner's plan: locked, never hidden",
      read: {
        offered: { subjects: ["Matemática"] },
        plusRequired: true,
        status: "offered",
        tool: "mockExam",
      },
      sent: true,
    },
    {
      core: { reason: "noMock" as const, status: "unavailable" as const },
      plan: "nothing to build one from yet: no card",
      read: { reason: "noMock", status: "unavailable", tool: "mockExam" },
      sent: false,
    },
  ])("offers a mock exam $plan", async ({ core, read, sent }) => {
    vi.mocked(claimLessonQuestionAnswer).mockResolvedValue({
      claim: {
        analytics: { distinctId: USER_ID, goalId: GOAL_ID },
        contextSnapshot: { language: "en", scope: { kind: "plan" } },
        learnerMemory: [],
        priorTurns: [],
        question: "I want to practice with a mock exam",
        questionId: QUESTION_ID,
        revision: 4,
        shareAnswer: false,
      },
      status: "ready",
    } as never);

    vi.mocked(offerTutorTool).mockResolvedValue(core);
    const modelRead: unknown[] = [];

    vi.mocked(streamGoalTutorAnswer).mockImplementation((input) =>
      createGoalTutorGeneration({
        ...input,
        calls: [MOCK_CALL],
        offerAppTool: async (offer) => {
          const result = await input.offerAppTool(offer);
          modelRead.push(result);
          return result;
        },
      }),
    );

    const response = await createAnswerResponse();
    const body = await response.text();
    await Promise.all(afterTasks);

    expect(offerTutorTool).toHaveBeenCalledExactlyOnceWith({
      area: null,
      goalWords: null,
      questionId: QUESTION_ID,
      revision: 4,
      tool: "mockExam",
      topic: null,
    });

    // The buddy reads what the card opens (locked when the plan doesn't include it), or why
    // there's none, to say it in its words.
    expect(modelRead).toStrictEqual([read]);

    // A mock that can't be built never reaches the conversation as a card; a locked one does.
    expect(body.includes('"type":"data-tool-offer"')).toBe(sent);
    expect(body.includes('"kind":"mockExam"')).toBe(sent);
  });

  it("starts a new goal with the learner's words and keeps one card per message", async () => {
    vi.mocked(claimLessonQuestionAnswer).mockResolvedValue({
      claim: {
        analytics: { distinctId: USER_ID, goalId: GOAL_ID },
        contextSnapshot: { language: "en", scope: { kind: "plan" } },
        learnerMemory: [],
        priorTurns: [],
        question: "I also want to learn the guitar. Is Yousician good?",
        questionId: QUESTION_ID,
        revision: 5,
        shareAnswer: false,
      },
      status: "ready",
    } as never);

    vi.mocked(offerTutorTool).mockResolvedValue({
      offer: { access: "open", course: null, goal: "Learn to play the guitar", kind: "startGoal" },
      status: "offered",
    });

    const modelRead: unknown[] = [];

    // The model asks for two cards in one step; they run together.
    const startGoalCall: ProviderStreamPart = {
      input: JSON.stringify({
        area: null,
        goal: "Learn to play the guitar",
        tool: "startGoal",
        topic: "Guitar",
      }),
      toolCallId: "call-goal",
      toolName: "offerAppTool",
      type: "tool-call",
    };

    vi.mocked(streamGoalTutorAnswer).mockImplementation((input) =>
      createGoalTutorGeneration({
        ...input,
        calls: [startGoalCall, MOCK_CALL],
        offerAppTool: async (offer) => {
          const result = await input.offerAppTool(offer);
          modelRead.push(result);
          return result;
        },
      }),
    );

    const response = await createAnswerResponse();
    const body = await response.text();
    await Promise.all(afterTasks);

    expect(offerTutorTool).toHaveBeenCalledExactlyOnceWith({
      area: null,
      goalWords: "Learn to play the guitar",
      questionId: QUESTION_ID,
      revision: 5,
      tool: "startGoal",
      topic: "Guitar",
    });

    expect(modelRead).toStrictEqual([
      { offered: {}, status: "offered", tool: "startGoal" },
      { reason: "onePerMessage", status: "unavailable", tool: "mockExam" },
    ]);

    expect(body).toContain('"kind":"startGoal"');
    expect(body).not.toContain('"kind":"mockExam"');
  });
});
