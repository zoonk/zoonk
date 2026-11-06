import {
  NoObjectGeneratedError,
  Output,
  generateText,
  streamText,
  tool,
  wrapLanguageModel,
} from "ai";
import { MockLanguageModelV4, convertArrayToReadableStream } from "ai/test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { type AiGeneration, registerAiGenerationSink } from "./ai-generation-sink";
import {
  type BilledCall,
  billedCallMiddleware,
  meterAsExtra,
  meterBilledCalls,
} from "./billed-calls";
import { runTaskGeneration, streamTaskGeneration } from "./run-task-generation";

const MODEL = "openai/gpt-6-sol";
const SYSTEM_PROMPT = "You name courses.";
const schema = z.object({ title: z.string() });

function usage(inputTokens: number) {
  return {
    inputTokens: { cacheRead: 0, cacheWrite: 0, noCache: inputTokens, total: inputTokens },
    outputTokens: { reasoning: 0, text: 500, total: 500 },
  };
}

/** As the default provider serves a gateway model id. */
function answering(text: string, inputTokens = 1000) {
  return wrapLanguageModel({
    middleware: billedCallMiddleware,
    model: new MockLanguageModelV4({
      doGenerate: {
        content: [{ text, type: "text" }],
        finishReason: { raw: "stop", unified: "stop" },
        usage: usage(inputTokens),
        warnings: [],
      },
      doStream: {
        stream: convertArrayToReadableStream([
          { type: "stream-start", warnings: [] },
          { id: "1", type: "text-start" },
          { delta: text, id: "1", type: "text-delta" },
          { id: "1", type: "text-end" },
          {
            finishReason: { raw: "stop", unified: "stop" },
            type: "finish",
            usage: usage(inputTokens),
          },
        ]),
      },
      modelId: MODEL,
      provider: "gateway",
    }),
  });
}

function nameCourse(text: string, inputTokens?: number) {
  return runTaskGeneration({
    generate: () =>
      generateText({
        instructions: SYSTEM_PROMPT,
        model: answering(text, inputTokens),
        output: Output.object({ schema }),
        prompt: "Photosynthesis",
      }),
    systemPrompt: SYSTEM_PROMPT,
    task: "course-details",
  });
}

function watchLoggedRuns() {
  const logged: AiGeneration[] = [];

  registerAiGenerationSink("ai-calls", (generation) => {
    logged.push(generation);
  });

  return {
    logged,
    runs: () =>
      logged.map(({ properties, provenance }) => ({
        failed: properties?.$ai_is_error === true,
        inputTokens: provenance.usage.inputTokens,
      })),
  };
}

describe("billed calls", () => {
  beforeEach(() => {
    vi.stubEnv("E2E_TESTING", "false");
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VITEST", "false");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    globalThis.zoonkAiGenerationSinks = undefined;
  });

  it("logs a run once when its answer passes", async () => {
    const log = watchLoggedRuns();
    const { result } = await nameCourse('{"title":"Plants"}');

    expect(result.output).toStrictEqual({ title: "Plants" });
    expect(log.runs()).toStrictEqual([{ failed: false, inputTokens: 1000 }]);
  });

  it("logs the call behind a run whose answer fails its schema, marked failed", async () => {
    const log = watchLoggedRuns();
    const error = await nameCourse('{"name":"Plants"}').catch((error_: unknown) => error_);

    expect(error).toBeInstanceOf(NoObjectGeneratedError);
    expect(log.runs()).toStrictEqual([{ failed: true, inputTokens: 1000 }]);
    expect(log.logged[0]).toMatchObject({ provenance: { model: MODEL }, task: "course-details" });
  });

  it("logs a streamed call that its run reads to an answer off its schema", async () => {
    const log = watchLoggedRuns();

    const run = runTaskGeneration({
      generate: async () => {
        const generation = streamText({
          model: answering("not json"),
          output: Output.object({ schema }),
          prompt: "Photosynthesis",
        });

        await generation.output;
        return { finalStep: await generation.finalStep, steps: await generation.steps };
      },
      systemPrompt: SYSTEM_PROMPT,
      task: "skill-graph",
    });

    await expect(run).rejects.toThrow();
    expect(log.runs()).toStrictEqual([{ failed: true, inputTokens: 1000 }]);
  });

  it("logs a streamed answer once it ends, even when its output then fails its schema", async () => {
    const log = watchLoggedRuns();

    const { generation, provenance } = streamTaskGeneration({
      stream: () =>
        streamText({ model: answering("not json"), output: Output.object({ schema }), prompt: "" }),
      systemPrompt: SYSTEM_PROMPT,
      task: "course-outline",
    });

    await expect(generation.output).rejects.toThrow();
    await expect(provenance).resolves.toMatchObject({ usage: { inputTokens: 1000 } });
    expect(log.runs()).toStrictEqual([{ failed: false, inputTokens: 1000 }]);
  });

  it("counts the tokens of the steps a stream finished before a later step failed", async () => {
    const log = watchLoggedRuns();

    const model = new MockLanguageModelV4({
      doStream: vi
        .fn()
        .mockResolvedValueOnce({
          stream: convertArrayToReadableStream([
            { type: "stream-start", warnings: [] },
            { input: "{}", toolCallId: "call-1", toolName: "search", type: "tool-call" },
            {
              finishReason: { raw: "tool_calls", unified: "tool-calls" },
              type: "finish",
              usage: usage(700),
            },
          ]),
        })
        .mockRejectedValueOnce(new Error("The provider is down.")),
      modelId: MODEL,
    });

    const { generation, provenance } = streamTaskGeneration({
      stream: () =>
        streamText({
          model,
          onError: () => {},
          prompt: "",
          stopWhen: () => false,
          tools: { search: tool({ execute: async () => "found", inputSchema: z.object({}) }) },
        }),
      systemPrompt: SYSTEM_PROMPT,
      task: "goal-tutor",
    });

    await generation.consumeStream();

    await expect(provenance).resolves.toMatchObject({ usage: { inputTokens: 700 } });
    expect(log.runs()).toStrictEqual([{ failed: false, inputTokens: 700 }]);
  });

  it("leaves a nested run's calls to it when the run around it fails", async () => {
    const log = watchLoggedRuns();

    const outer = runTaskGeneration({
      generate: async () => {
        await nameCourse('{"title":"Plants"}');
        throw new Error("The outline needs more chapters.");
      },
      systemPrompt: SYSTEM_PROMPT,
      task: "course-outline",
    });

    await expect(outer).rejects.toThrow("more chapters");
    expect(log.runs()).toStrictEqual([{ failed: false, inputTokens: 1000 }]);
  });
});

describe(meterBilledCalls, () => {
  it("meters every call its work makes, whether its runs pass or throw, marking extra work's", async () => {
    const calls: BilledCall[] = [];

    const work = meterBilledCalls(calls, async () => {
      await nameCourse('{"title":"Kept"}', 1000);
      await nameCourse('{"name":"Rejected"}', 2000).catch(() => null);
      await meterAsExtra(() => nameCourse('{"name":"Checked"}', 3000));
    });

    await expect(work).rejects.toThrow(NoObjectGeneratedError);

    expect(calls.map((call) => [call.model, call.usage.inputTokens, call.extra])).toStrictEqual([
      [MODEL, 1000, false],
      [MODEL, 2000, false],
      [MODEL, 3000, true],
    ]);
  });
});
