import { type LanguageModelUsage, generateText } from "ai";
import { describe, expect, it, vi } from "vitest";
import { generateLevelTestBank } from "./level-test-bank";
import type * as Ai from "ai";

vi.mock("server-only", () => ({}));
vi.mock("./level-test-bank.prompt.md", () => ({ default: "Write one level of the bank." }));

// Each level is a paid model call; the test answers them itself to check how the bank is put together.
vi.mock("ai", async (importOriginal) => ({
  ...(await importOriginal<typeof Ai>()),
  generateText: vi.fn(),
}));

const MODEL = "anthropic/claude-opus-5.5";

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

function writeLevel(level: string) {
  const step = {
    model: { modelId: MODEL, provider: "gateway" },
    providerMetadata: { gateway: { cost: "0.05" } },
    response: { modelId: MODEL },
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

/** Holds every level's answer until the test releases them, and names the level each call asked for. */
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
    expect(provenance).toMatchObject({ costUsd: expect.closeTo(0.25), model: MODEL });
  });
});
