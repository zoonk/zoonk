import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type AiGeneration, registerAiGenerationSink } from "../provenance/ai-generation-sink";
import { type BilledCall, meterBilledCalls } from "../provenance/billed-calls";
import { evaluateQuestions } from "./evaluate-questions";

const MODEL = "openai/gpt-6-luna";

const answers = vi.hoisted(() => ({ text: "" }));

vi.mock("server-only", () => ({}));

vi.mock("../gateway", async () => {
  const { MockLanguageModelV4: Mock } = await import("ai/test");

  return {
    zoonkGateway: {
      languageModel: () =>
        new Mock({
          doGenerate: async () => ({
            content: [{ text: answers.text, type: "text" }],
            finishReason: { raw: "stop", unified: "stop" },
            usage: {
              inputTokens: { cacheRead: 0, cacheWrite: 0, noCache: 1000, total: 1000 },
              outputTokens: { reasoning: 0, text: 500, total: 500 },
            },
            warnings: [],
          }),
          modelId: MODEL,
        }),
    },
  };
});

function decide() {
  return evaluateQuestions({
    input: { QUESTION: "How do plants make food?" },
    model: MODEL,
    questions: { isGeneral: { instructions: "Is it general?", type: "boolean" } },
    task: "question-generality",
  });
}

function watchLogged() {
  const logged: AiGeneration[] = [];

  registerAiGenerationSink("ai-calls", (generation) => {
    logged.push(generation);
  });

  return logged;
}

describe("a decision a language model answers", () => {
  beforeEach(() => {
    vi.stubEnv("E2E_TESTING", "false");
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VITEST", "false");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    globalThis.zoonkAiGenerationSinks = undefined;
  });

  it("logs its billed call, marked failed, when its parser rejects the answer", async () => {
    answers.text = "not JSON";
    const logged = watchLogged();
    const billed: BilledCall[] = [];

    await expect(meterBilledCalls(billed, decide)).rejects.toThrow();

    expect(billed.map((call) => call.usage.inputTokens)).toStrictEqual([1000]);

    expect(
      logged.map(({ properties, provenance, task }) => ({
        failed: properties?.$ai_is_error,
        inputTokens: provenance.usage.inputTokens,
        task,
      })),
    ).toStrictEqual([{ failed: true, inputTokens: 1000, task: "question-generality" }]);
  });

  it("logs an answer that passes once", async () => {
    answers.text = '{"q0":0.9}';
    const logged = watchLogged();

    await expect(decide()).resolves.toMatchObject({ answers: { isGeneral: { probability: 0.9 } } });

    expect(logged.map(({ properties }) => properties?.$ai_is_error)).toStrictEqual([undefined]);
  });
});
