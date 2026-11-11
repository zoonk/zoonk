import { type LanguageModelUsage, generateText } from "ai";
import { describe, expect, it, vi } from "vitest";
import { generateLevelTestBank } from "./level-test-bank";
import type * as Ai from "ai";

vi.mock("server-only", () => ({}));
vi.mock("./level-test-bank.prompt.md", () => ({ default: "Write one level of the bank." }));

vi.mock("ai", async (importOriginal) => ({
  ...(await importOriginal<typeof Ai>()),
  generateText: vi.fn(),
}));

const MODEL = "anthropic/claude-fable-5.2";

const usage: LanguageModelUsage = {
  inputTokenDetails: { cacheReadTokens: 0, cacheWriteTokens: 0, noCacheTokens: 1000 },
  inputTokens: 1000,
  outputTokenDetails: { reasoningTokens: 200, textTokens: 800 },
  outputTokens: 1000,
  totalTokens: 2000,
};

type LevelCall = { level: string; resolve: () => void };

function writeQuestion(label: string) {
  return {
    correctOption: `right ${label}`,
    evidence: "quoted",
    lowerLevelMistake: "misread",
    passage: `passage ${label}`,
    question: `question ${label}`,
    tests: "one stated fact",
    wrongOptions: [`wrong 1 ${label}`, `wrong 2 ${label}`, `wrong 3 ${label}`],
  };
}

function withTwoWrongOptions(questions: ReturnType<typeof writeQuestion>[]) {
  return questions.map((question) => ({
    ...question,
    wrongOptions: question.wrongOptions.slice(0, 2),
  }));
}

function writeLevel(level: string) {
  const step = {
    model: { modelId: MODEL, provider: "gateway" },
    providerMetadata: { gateway: { cost: "0.05" } },
    response: { modelId: MODEL },
    usage,
  };

  return {
    finalStep: step,
    output: {
      listening: [writeQuestion(`${level} listening 1`), writeQuestion(`${level} listening 2`)],
      reading: [writeQuestion(`${level} reading 1`), writeQuestion(`${level} reading 2`)],
      speaking: { sentence: `sentence ${level}`, translation: `translation ${level}` },
    },
    steps: [step],
    usage,
  };
}

function answerLevelsLater(): LevelCall[] {
  const calls: LevelCall[] = [];

  vi.mocked(generateText).mockImplementation(({ prompt }) => {
    const text = typeof prompt === "string" ? prompt : "";
    const level = /LEVEL: (?<level>\w\d)/u.exec(text)?.groups?.level ?? "none";
    const { promise, resolve } = Promise.withResolvers<null>();
    calls.push({ level, resolve: () => resolve(null) });

    return promise.then(() => writeLevel(level)) as never;
  });

  return calls;
}

describe(generateLevelTestBank, () => {
  it("writes every level in its own call at the same time and keeps each question at its level", async () => {
    const calls = answerLevelsLater();
    const pending = generateLevelTestBank({ learnerLanguage: "pt", targetLanguage: "en" });

    await expect.poll(() => calls.length).toBe(5);
    expect(calls.map((call) => call.level)).toStrictEqual(["A1", "A2", "B1", "B2", "C1"]);

    for (const call of calls) {
      call.resolve();
    }

    const { data, provenance, usage: total } = await pending;

    for (const [options] of vi.mocked(generateText).mock.calls) {
      expect(options.model).toBe(MODEL);

      expect(options.providerOptions?.gateway).toMatchObject({
        models: [
          "anthropic/claude-opus-5.5",
          "anthropic/claude-sonnet-5.5",
          "openai/gpt-6.1-terra",
        ],
      });
    }

    expect(data.questions).toHaveLength(20);

    expect(
      data.questions.every(
        (question) =>
          question.passage.startsWith(`passage ${question.level} ${question.skill}`) &&
          question.options[question.answerIndex] === question.passage.replace("passage", "right"),
      ),
    ).toBe(true);

    expect(data.speaking).toStrictEqual(
      ["A1", "A2", "B1", "B2", "C1"].map((level) => ({
        level,
        sentence: `sentence ${level}`,
        translation: `translation ${level}`,
      })),
    );

    expect(total.inputTokens).toBe(5000);
    expect(provenance).toMatchObject({ gatewayCostUsd: expect.closeTo(0.25), model: MODEL });
  });

  it("keeps four options on every question instead of failing a level over its wrong options", async () => {
    vi.mocked(generateText).mockImplementation(({ prompt }) => {
      const text = typeof prompt === "string" ? prompt : "";
      const level = /LEVEL: (?<level>\w\d)/u.exec(text)?.groups?.level ?? "none";
      const written = writeLevel(level);
      const [first, second] = written.output.reading;

      const reading = [
        { ...first, wrongOptions: [...(first?.wrongOptions ?? []), `wrong 4 ${level}`] },
        { ...second, wrongOptions: second?.wrongOptions.slice(0, 2) ?? [] },
      ];

      return Promise.resolve({ ...written, output: { ...written.output, reading } }) as never;
    });

    const { data } = await generateLevelTestBank({ learnerLanguage: "pt", targetLanguage: "en" });
    const reading = data.questions.filter((question) => question.skill === "reading");

    expect(reading.map((question) => question.passage)).toStrictEqual(
      ["A1", "A2", "B1", "B2", "C1"].map((level) => `passage ${level} reading 1`),
    );

    expect(data.questions.every((question) => question.options.length === 4)).toBe(true);

    expect(
      reading.some((question) => question.options.some((option) => option.startsWith("wrong 4"))),
    ).toBe(false);
  });

  it("fails the bank for a retry when no question kept its wrong options", async () => {
    vi.mocked(generateText).mockImplementation(({ prompt }) => {
      const text = typeof prompt === "string" ? prompt : "";
      const level = /LEVEL: (?<level>\w\d)/u.exec(text)?.groups?.level ?? "none";
      const written = writeLevel(level);

      const output = {
        ...written.output,
        listening: withTwoWrongOptions(written.output.listening),
        reading: withTwoWrongOptions(written.output.reading),
      };

      return Promise.resolve({ ...written, output }) as never;
    });

    await expect(
      generateLevelTestBank({ learnerLanguage: "pt", targetLanguage: "en" }),
    ).rejects.toThrow("three wrong options");
  });

  it("sets every level's texts where the tested language is spoken", async () => {
    const calls = answerLevelsLater();
    const pending = generateLevelTestBank({ learnerLanguage: "pt", targetLanguage: "it" });

    await expect.poll(() => calls.length).toBe(5);

    for (const call of calls) {
      call.resolve();
    }

    await pending;

    const prompts = vi
      .mocked(generateText)
      .mock.calls.map(([options]) => (typeof options.prompt === "string" ? options.prompt : ""));

    expect(prompts.every((prompt) => prompt.includes("- Place: Italy"))).toBe(true);
    expect(prompts.some((prompt) => /Brazil|Register/u.test(prompt))).toBe(false);
  });
});
