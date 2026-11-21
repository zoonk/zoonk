import "server-only";
import { randomUUID } from "node:crypto";
import { Output, generateText } from "ai";
import { z } from "zod";
import { type AiGenerationContext } from "../../provenance/ai-generation-event";
import {
  combineTaskProvenance,
  sumLanguageModelUsage,
} from "../../provenance/combine-task-provenance";
import { runTaskGeneration } from "../../provenance/run-task-generation";
import { type Reasoning, buildProviderOptions } from "../../provider-options";
import {
  type LevelTestLanguages,
  QUESTION_SITUATIONS,
  QUESTION_TESTS,
  formatLevelTestLanguages,
  formatWords,
  hashText,
  withLevelTestRules,
} from "./_utils/level-test-writing";
import template from "./level-test-bank.prompt.md";
import {
  type GenerateLevelTestConfirmationsParams,
  type LevelTestConfirmation,
  generateLevelTestConfirmations,
} from "./level-test-confirmations";
import {
  LEVEL_TEST_LEVELS,
  LEVEL_TEST_PASSAGE_WORDS,
  LEVEL_TEST_SKILLS,
  type LevelTestSkill,
  type TestLevel,
} from "./level-test-levels";

/**
 * Written once per pair and shared, so quality wins. On 8 banks (11 Nov 2026), a blind GPT-6.1 Sol
 * read preferred Fable to Opus on 6, Opus on 1 and tied 1; Fable keyed one German afternoon time as
 * 3:15 and Opus left two keys ambiguous. Judges scored them 8.96 to 8.67, at $2,126 against $652
 * per 1k banks. On 11 banks (8 Nov 2026), blind Argon judging preferred Opus to Sonnet 5.5 by 0.58
 * and to Terra at high reasoning by 1.06 (PT 1.36). Terra runs at its default reasoning here, below
 * the PT floor (7.36), so it's only an outage route. A second review call didn't help.
 */
const defaultModel = "anthropic/claude-fable-5.2";

const fallbackModels = [
  "anthropic/claude-opus-5.5",
  "anthropic/claude-sonnet-5.5",
  "openai/gpt-6.1-terra",
] as const;

/** A level's questions per skill: enough for a whole-course test to stop on its own. */
const LEVEL_TEST_QUESTIONS_PER_SKILL = 12;

/** Short calls side by side, so a learner waiting on the bank waits for the longest of them. */
const QUESTIONS_PER_CALL = 4;

/** The test's scoring counts on a one-in-four guess, so every question shows four options. */
const WRONG_OPTIONS = 3;
const OPTIONS_PER_QUESTION = WRONG_OPTIONS + 1;

const systemPrompt = withLevelTestRules(template);

/* oxlint-disable eslint/sort-keys -- Structured output follows schema property order: what the question tests comes first, then the text, its question, the evidence for the answer, how a learner one level below would misread it, and the right option before the wrong ones. */
function createQuestionsSchema(level: TestLevel) {
  const questionSchema = z.object({
    tests: z.enum(QUESTION_TESTS[level]),
    passage: z.string(),
    question: z.string(),
    evidence: z.string(),
    lowerLevelMistake: z.string(),
    correctOption: z.string(),
    wrongOptions: z.array(z.string()),
  });

  return z.object({ questions: z.array(questionSchema) });
}
/* oxlint-enable eslint/sort-keys */

type GeneratedQuestion = z.infer<ReturnType<typeof createQuestionsSchema>>["questions"][number];

export type LevelTestQuestion = {
  skill: LevelTestSkill;
  level: TestLevel;
  passage: string;
  question: string;
  options: string[];
  answerIndex: number;
};

export type GenerateLevelTestBankSchema = {
  questions: LevelTestQuestion[];
  confirmations: LevelTestConfirmation[];
};

export type GenerateLevelTestBankParams = LevelTestLanguages & {
  model?: string;
  useFallback?: boolean;
  reasoning?: Reasoning;
  analytics?: AiGenerationContext;
};

function toTestQuestion({
  level,
  question,
  skill,
}: {
  level: TestLevel;
  question: GeneratedQuestion;
  skill: LevelTestSkill;
}): LevelTestQuestion {
  const answerIndex = hashText(`${question.passage}${question.question}`) % OPTIONS_PER_QUESTION;
  const { correctOption, passage, wrongOptions } = question;

  return {
    answerIndex,
    level,
    options: wrongOptions.slice(0, WRONG_OPTIONS).toSpliced(answerIndex, 0, correctOption),
    passage,
    question: question.question,
    skill,
  };
}

function buildQuestionsPrompt({
  level,
  situations,
  skill,
  ...languages
}: LevelTestLanguages & {
  level: TestLevel;
  situations: readonly string[];
  skill: LevelTestSkill;
}): string {
  return `
${formatLevelTestLanguages(languages)}
LEVEL: ${level}
SKILL: ${skill}
WORDS: ${formatWords(LEVEL_TEST_PASSAGE_WORDS[level][skill])}
SITUATIONS:
${situations.map((situation, index) => `- ${index + 1}: ${situation}`).join("\n")}
`;
}

type QuestionsCall = GenerateLevelTestBankParams & {
  level: TestLevel;
  situations: readonly string[];
  skill: LevelTestSkill;
};

async function writeQuestions(params: QuestionsCall) {
  const { analytics, level, model = defaultModel, reasoning, skill, useFallback = true } = params;
  const userPrompt = buildQuestionsPrompt(params);
  const providerOptions = buildProviderOptions({ fallbackModels, model, useFallback });

  const { provenance, result } = await runTaskGeneration({
    analytics,
    generate: () =>
      generateText({
        instructions: systemPrompt,
        model,
        output: Output.object({ schema: createQuestionsSchema(level) }),
        prompt: userPrompt,
        providerOptions,
        reasoning,
      }),
    libraryInput: true,
    systemPrompt,
    task: "level-test-bank",
  });

  const questions = result.output.questions
    .filter((question) => question.wrongOptions.length >= WRONG_OPTIONS)
    .map((question) => toTestQuestion({ level, question, skill }));

  return { provenance, questions, usage: result.usage, userPrompt };
}

function chunk<Item>(items: readonly Item[], size: number): Item[][] {
  return Array.from({ length: Math.ceil(items.length / size) }, (_, index) =>
    items.slice(index * size, (index + 1) * size),
  );
}

/** `count` questions of one skill at one level, each on its own situation. */
async function generateLevelTestQuestions({
  count = LEVEL_TEST_QUESTIONS_PER_SKILL,
  ...params
}: GenerateLevelTestBankParams & { count?: number; level: TestLevel; skill: LevelTestSkill }) {
  const situations = QUESTION_SITUATIONS[params.level][params.skill].slice(0, count);

  const calls = await Promise.all(
    chunk(situations, QUESTIONS_PER_CALL).map((slice) =>
      writeQuestions({ ...params, situations: slice }),
    ),
  );

  return {
    data: { questions: calls.flatMap((call) => call.questions) },
    provenance: combineTaskProvenance(calls.map((call) => call.provenance)),
    systemPrompt,
    usage: sumLanguageModelUsage(calls.map((call) => call.usage)),
    userPrompt: calls.map((call) => call.userPrompt).join("\n"),
  };
}

type GenerateLevelTestBankLevelParams = GenerateLevelTestBankParams &
  Pick<GenerateLevelTestConfirmationsParams, "level">;

/** A whole level: its questions in each skill and its confirmations. */
export async function generateLevelTestBankLevel(params: GenerateLevelTestBankLevelParams) {
  const [reading, listening, confirmations] = await Promise.all([
    generateLevelTestQuestions({ ...params, skill: "reading" }),
    generateLevelTestQuestions({ ...params, skill: "listening" }),
    generateLevelTestConfirmations(params),
  ]);

  const parts = [reading, listening, confirmations];

  const data: GenerateLevelTestBankSchema = {
    confirmations: confirmations.data.confirmations,
    questions: [...reading.data.questions, ...listening.data.questions],
  };

  return {
    data,
    provenance: combineTaskProvenance(parts.map((part) => part.provenance)),
    systemPrompt,
    usage: sumLanguageModelUsage(parts.map((part) => part.usage)),
    userPrompt: parts.map((part) => part.userPrompt).join("\n"),
  };
}

/** Every level's questions, `questionsPerSkill` per skill: the bank its eval reads, levels side by side. */
export async function generateLevelTestBank({
  questionsPerSkill = LEVEL_TEST_QUESTIONS_PER_SKILL,
  ...params
}: GenerateLevelTestBankParams & { questionsPerSkill?: number }) {
  // The levels are one job, so their calls share a trace unless the caller's job already has one.
  const analytics = { ...params.analytics, traceId: params.analytics?.traceId ?? randomUUID() };

  const parts = await Promise.all(
    LEVEL_TEST_LEVELS.flatMap((level) =>
      LEVEL_TEST_SKILLS.map((skill) =>
        generateLevelTestQuestions({
          ...params,
          analytics,
          count: questionsPerSkill,
          level,
          skill,
        }),
      ),
    ),
  );

  return {
    data: { questions: parts.flatMap((part) => part.data.questions) },
    provenance: combineTaskProvenance(parts.map((part) => part.provenance)),
    systemPrompt,
    usage: sumLanguageModelUsage(parts.map((part) => part.usage)),
    userPrompt: parts.map((part) => part.userPrompt).join("\n"),
  };
}
