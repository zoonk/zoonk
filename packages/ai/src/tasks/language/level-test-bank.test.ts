import { type LanguageModelUsage, generateText } from "ai";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { QUESTION_SITUATIONS } from "./_utils/level-test-writing";
import {
  generateLevelTestBank,
  generateLevelTestBankLevel,
  generateLevelTestQuestions,
} from "./level-test-bank";
import { generateLevelTestConfirmations } from "./level-test-confirmations";
import type * as Ai from "ai";

vi.mock("server-only", () => ({}));

vi.mock("./level-test-bank.prompt.md", () => ({
  default: "Questions.\n{{LEVELS}}\n{{LANGUAGE_RULES}}\n",
}));

vi.mock("./level-test-confirmations.prompt.md", () => ({
  default: "Confirmations.\n{{LEVELS}}\n{{LANGUAGE_RULES}}\n",
}));

vi.mock("./level-test-ladder.prompt.md", () => ({ default: "# Levels\n" }));

vi.mock("./level-test-language-rules.prompt.md", () => ({ default: "# Language rules\n" }));

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

const step = {
  model: { modelId: MODEL, provider: "gateway" },
  providerMetadata: { gateway: { cost: "0.05" } },
  response: { modelId: MODEL },
  usage,
};

function answer(output: object) {
  return Promise.resolve({ finalStep: step, output, steps: [step], usage }) as never;
}

function promptOf(options: { prompt?: unknown }): string {
  return typeof options.prompt === "string" ? options.prompt : "";
}

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

function option(text: string, isCorrect: boolean) {
  return { evidence: "quoted", isCorrect, text };
}

function writeConfirmation(label: string) {
  return {
    lowerLevelMistake: "misread",
    options: [
      option(`right 1 ${label}`, true),
      option(`right 2 ${label}`, true),
      option(`wrong 1 ${label}`, false),
      option(`wrong 2 ${label}`, false),
      option(`wrong 3 ${label}`, false),
    ],
    passage: `passage ${label}`,
    question: `question ${label}`,
    tests: "one stated fact",
  };
}

/** Answers each call as asked: one question per situation, or a level's four confirmations. */
function answerAsAsked() {
  vi.mocked(generateText).mockImplementation((options) => {
    const prompt = promptOf(options);
    const level = /LEVEL: (?<level>\w\d)/u.exec(prompt)?.groups?.level ?? "none";
    const skill = /SKILL: (?<skill>\w+)/u.exec(prompt)?.groups?.skill;

    if (!skill) {
      return answer({
        listening: [1, 2].map((index) => writeConfirmation(`${level} listening ${index}`)),
        reading: [1, 2].map((index) => writeConfirmation(`${level} reading ${index}`)),
      });
    }

    const situations = [...prompt.matchAll(/^- \d+: (?<situation>.+)$/gmu)].map(
      (match) => match.groups?.situation ?? "",
    );

    return answer({
      questions: situations.map((situation) => writeQuestion(`${level} ${skill} ${situation}`)),
    });
  });
}

describe(generateLevelTestBankLevel, () => {
  beforeEach(() => {
    vi.clearAllMocks();
    answerAsAsked();
  });

  it("writes twelve questions per skill in short calls side by side, and the level's confirmations", async () => {
    const { data, provenance } = await generateLevelTestBankLevel({
      learnerLanguage: "pt",
      level: "C2",
      targetLanguage: "en",
    });

    const prompts = vi.mocked(generateText).mock.calls.map(([options]) => promptOf(options));

    expect(prompts.filter((prompt) => prompt.includes("SKILL: reading"))).toHaveLength(3);
    expect(prompts.filter((prompt) => prompt.includes("SKILL: listening"))).toHaveLength(3);
    expect(prompts.filter((prompt) => prompt.includes("READING_WORDS"))).toHaveLength(1);

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

    expect(data.questions.map((question) => question.passage)).toStrictEqual(
      (["reading", "listening"] as const).flatMap((skill) =>
        QUESTION_SITUATIONS.C2[skill].map((situation) => `passage C2 ${skill} ${situation}`),
      ),
    );

    expect(
      data.questions.every(
        (question) =>
          question.level === "C2" &&
          question.options.length === 4 &&
          question.options[question.answerIndex] === question.passage.replace("passage", "right"),
      ),
    ).toBe(true);

    expect(data.confirmations).toHaveLength(4);
    expect(provenance).toMatchObject({ gatewayCostUsd: expect.closeTo(0.35), model: MODEL });
  });
});

describe(generateLevelTestQuestions, () => {
  beforeEach(() => {
    vi.clearAllMocks();
    answerAsAsked();
  });

  it("grows a level on the situations after the ones it has", async () => {
    const { data } = await generateLevelTestQuestions({
      count: 10,
      from: 2,
      learnerLanguage: "pt",
      level: "A1",
      skill: "listening",
      targetLanguage: "it",
    });

    expect(data.questions.map((question) => question.passage)).toStrictEqual(
      QUESTION_SITUATIONS.A1.listening
        .slice(2)
        .map((situation) => `passage A1 listening ${situation}`),
    );

    const prompts = vi.mocked(generateText).mock.calls.map(([options]) => promptOf(options));

    expect(prompts.map((prompt) => prompt.match(/^- \d+: /gmu)?.length)).toStrictEqual([4, 4, 2]);
    expect(prompts.every((prompt) => prompt.includes("- Place: Italy"))).toBe(true);
    expect(prompts.some((prompt) => /Brazil|Register/u.test(prompt))).toBe(false);
  });

  it("keeps four options on every question and leaves out one short of wrong options", async () => {
    vi.mocked(generateText).mockImplementation(() => {
      const long = writeQuestion("long");
      const short = writeQuestion("short");

      return answer({
        questions: [
          { ...long, wrongOptions: [...long.wrongOptions, "wrong 4 long"] },
          { ...short, wrongOptions: short.wrongOptions.slice(0, 2) },
        ],
      });
    });

    const { data } = await generateLevelTestQuestions({
      count: 2,
      learnerLanguage: "pt",
      level: "B1",
      skill: "reading",
      targetLanguage: "en",
    });

    expect(data.questions.map((question) => question.passage)).toStrictEqual(["passage long"]);
    expect(data.questions[0]?.options).toHaveLength(4);
    expect(data.questions[0]?.options).not.toContain("wrong 4 long");
  });
});

describe(generateLevelTestConfirmations, () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("keys the right options wherever their order puts them, and leaves out what can't confirm a level", async () => {
    const good = writeConfirmation("good");
    const repeated = writeConfirmation("repeated");
    const allRight = writeConfirmation("all right");

    vi.mocked(generateText).mockImplementation(() =>
      answer({
        listening: [
          { ...allRight, options: allRight.options.map((each) => ({ ...each, isCorrect: true })) },
        ],
        reading: [
          good,
          { ...repeated, options: [...repeated.options.slice(0, 4), repeated.options[0]] },
        ],
      }),
    );

    const { data } = await generateLevelTestConfirmations({
      learnerLanguage: "pt",
      level: "B2",
      targetLanguage: "en",
    });

    expect(data.confirmations).toHaveLength(1);

    const [confirmation] = data.confirmations;

    expect(confirmation).toMatchObject({ level: "B2", passage: "passage good", skill: "reading" });

    expect(confirmation?.options.toSorted()).toStrictEqual(
      good.options.map((each) => each.text).toSorted(),
    );

    expect(
      confirmation?.answerIndices.map((index) => confirmation.options[index]).toSorted(),
    ).toStrictEqual(["right 1 good", "right 2 good"]);
  });
});

describe(generateLevelTestBank, () => {
  beforeEach(() => {
    vi.clearAllMocks();
    answerAsAsked();
  });

  it("writes every level's questions through C2, as many per skill as asked", async () => {
    const { data } = await generateLevelTestBank({
      learnerLanguage: "pt",
      questionsPerSkill: 2,
      targetLanguage: "en",
    });

    expect([...new Set(data.questions.map((question) => question.level))]).toStrictEqual([
      "A1",
      "A2",
      "B1",
      "B2",
      "C1",
      "C2",
    ]);

    expect(data.questions).toHaveLength(6 * 2 * 2);
  });
});
