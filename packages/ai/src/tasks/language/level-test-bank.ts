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
import { type Reasoning, type ServiceTier, buildProviderOptions } from "../../provider-options";
import {
  type LevelTestLanguages,
  QUESTION_SITUATIONS,
  QUESTION_TESTS,
  formatLevelTestPlace,
  formatWords,
  hashText,
  withLevelTestRules,
} from "./_utils/level-test-writing";
import { type LevelTestBankPart, getLevelTestQuestionBatches } from "./level-test-bank-parts";
import template from "./level-test-bank.prompt.md";
import {
  type LevelTestConfirmation,
  generateLevelTestConfirmations,
} from "./level-test-confirmations";
import {
  LEVEL_TEST_LEVELS,
  LEVEL_TEST_PASSAGE_WORDS,
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

/** The test's scoring counts on a one-in-four guess, so every question shows four options. */
const WRONG_OPTIONS = 3;
const OPTIONS_PER_QUESTION = WRONG_OPTIONS + 1;

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
  serviceTier?: ServiceTier;
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
  targetLanguage,
}: {
  level: TestLevel;
  situations: readonly string[];
  skill: LevelTestSkill;
  targetLanguage: string;
}): string {
  return `
${formatLevelTestPlace(targetLanguage)}
LEVEL: ${level}
SKILL: ${skill}
WORDS: ${formatWords(LEVEL_TEST_PASSAGE_WORDS[level][skill])}
SITUATIONS:
${situations.map((situation, index) => `- ${index + 1}: ${situation}`).join("\n")}
`;
}

async function writeQuestions({
  part: { count, offset, skill },
  ...params
}: GenerateLevelTestBankParams & {
  level: TestLevel;
  part: Exclude<LevelTestBankPart, "confirmations">;
}) {
  const { analytics, level, model = defaultModel, reasoning, useFallback = true } = params;
  const situations = QUESTION_SITUATIONS[level][skill].slice(offset, offset + count);
  const systemPrompt = withLevelTestRules({ ...params, template });
  const userPrompt = buildQuestionsPrompt({ ...params, situations, skill });

  const providerOptions = buildProviderOptions({
    fallbackModels,
    model,
    serviceTier: params.serviceTier,
    useFallback,
  });

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

  return { data: { questions }, provenance, systemPrompt, usage: result.usage, userPrompt };
}

export async function generateLevelTestBankPart({
  part,
  ...params
}: GenerateLevelTestBankParams & { level: TestLevel; part: LevelTestBankPart }) {
  const result =
    part === "confirmations"
      ? await generateLevelTestConfirmations(params)
      : await writeQuestions({ ...params, part });

  const data: GenerateLevelTestBankSchema = { confirmations: [], questions: [], ...result.data };
  return { ...result, data };
}

/** Every level's questions, `questionsPerSkill` per skill: the bank its eval reads, levels side by side. */
export async function generateLevelTestBank({
  questionsPerSkill,
  ...params
}: GenerateLevelTestBankParams & { questionsPerSkill?: number }) {
  // The levels are one job, so their calls share a trace unless the caller's job already has one.
  const analytics = { ...params.analytics, traceId: params.analytics?.traceId ?? randomUUID() };

  const parts = await Promise.all(
    LEVEL_TEST_LEVELS.flatMap((level) =>
      getLevelTestQuestionBatches(questionsPerSkill).map((part) =>
        generateLevelTestBankPart({ ...params, analytics, level, part }),
      ),
    ),
  );

  return {
    data: { questions: parts.flatMap((part) => part.data.questions) },
    provenance: combineTaskProvenance(parts.map((part) => part.provenance)),
    systemPrompt: withLevelTestRules({ ...params, template }),
    usage: sumLanguageModelUsage(parts.map((part) => part.usage)),
    userPrompt: parts.map((part) => part.userPrompt).join("\n"),
  };
}
