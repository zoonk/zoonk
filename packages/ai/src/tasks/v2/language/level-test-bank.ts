import "server-only";
import { randomUUID } from "node:crypto";
import { type CefrLevel } from "@zoonk/utils/cefr";
import { Output, generateText } from "ai";
import { z } from "zod";
import { type AiGenerationContext } from "../../../provenance/ai-generation-event";
import { runTaskGeneration } from "../../../provenance/run-task-generation";
import { combineTaskProvenance, sumLanguageModelUsage } from "../../../provenance/task-provenance";
import { type Reasoning, buildProviderOptions } from "../../../provider-options";
import { getLanguagePromptContext } from "../../_utils/prompt-language";
import systemPrompt from "./level-test-bank.prompt.md";

/**
 * Written once per language pair and stored for every learner of that pair, so quality wins over
 * cost and speed. Written as one call for the whole bank, Opus 5.5 scored 7.92 in English and 7.54
 * in Portuguese (one bank each, 27 Sep) at 119s p50 and $0.34 a bank, Sol 8.00 and 6.85 at 82s,
 * and Luna 7.37 and 7.40; the judge capped every one for a B2 or C1 question that read a level
 * below or an A2 question that read like A1. A Luna version that also wrote each level apart and
 * had a second call review B2 and C1 scored 7.54 in both (within noise) at 85s instead of 27s, so
 * it was reverted, and a review pass isn't tried again without an eval showing it helps.
 *
 * Each level is now written in its own call, all at once, from level descriptions with their own
 * text lengths, situations that move from concrete to abstract, and what a learner one level below
 * would misread. Opus 5.5 then scored 9.00 for English speakers learning Portuguese, 7.54 for
 * Brazilians learning English and 7.65 for English speakers learning German (one bank each, 28
 * Sep), at 80s p50 and 98s p95 and $0.62 to $0.69 a bank. Two banks were still capped for one C1
 * question: an idiom its text explained or any reader of the idiom could answer, and an
 * understatement whose answer overstated it. The prompt now rules both out; that last change
 * hasn't been through the eval.
 */
const defaultModel = "anthropic/claude-opus-5.5";
const fallbackModels = ["openai/gpt-6-luna"] as const;

/** C2 isn't placed by a three-minute test. */
const TEST_LEVELS = ["A1", "A2", "B1", "B2", "C1"] as const satisfies readonly CefrLevel[];
const TEST_SKILLS = ["reading", "listening"] as const;
const QUESTIONS_PER_SKILL = 2;
const WRONG_OPTIONS = 3;
const OPTIONS_PER_QUESTION = WRONG_OPTIONS + 1;

type TestLevel = (typeof TEST_LEVELS)[number];
type TestSkill = (typeof TEST_SKILLS)[number];
type WordRange = { max: number; min: number };

/**
 * What a question may check at each level, as the prompt's level descriptions name them. The model
 * picks one before writing the text, so a B2 question is planned as an implication instead of
 * drifting into a stated detail.
 */
const QUESTION_TESTS = {
  A1: ["one stated fact"],
  A2: ["two stated facts put together", "the order of events"],
  B1: ["the main point", "a reason", "a stated opinion"],
  B2: ["an implied attitude", "the writer's purpose", "the point of an argument"],
  C1: ["implicit meaning", "the speaker's stance", "tone or register", "a qualified or mixed view"],
} as const satisfies Record<TestLevel, readonly [string, ...string[]]>;

/**
 * How long each level's texts are, in words: a sentence or two at A1, a paragraph at B1, and longer
 * texts at B2 and C1, whose answers rest on clues spread across them. Voice messages play at
 * speaking pace, so they're shorter, and an advanced learner's six questions still take only a few
 * minutes. The eval's code checks read the same limits.
 */
export const LEVEL_TEST_PASSAGE_WORDS = {
  A1: { listening: { max: 25, min: 10 }, reading: { max: 25, min: 8 } },
  A2: { listening: { max: 40, min: 25 }, reading: { max: 45, min: 25 } },
  B1: { listening: { max: 65, min: 45 }, reading: { max: 75, min: 50 } },
  B2: { listening: { max: 85, min: 60 }, reading: { max: 100, min: 70 } },
  C1: { listening: { max: 100, min: 75 }, reading: { max: 120, min: 90 } },
} as const satisfies Record<TestLevel, Record<TestSkill, WordRange>>;

const SPEAKING_WORDS = {
  A1: "4 to 6",
  A2: "about 8",
  B1: "about 12",
  B2: "about 16",
  C1: "about 20",
} as const satisfies Record<TestLevel, string>;

/**
 * Each question's situation. The levels are written at the same time, so this keeps them from
 * reusing one, and the topics move from concrete and personal at A1 to abstract and professional
 * at C1, as CEFR's descriptors do.
 */
const SITUATIONS = {
  A1: {
    listening: ["getting around town", "meeting a friend"],
    reading: ["a shop, café or market", "a home or a family"],
  },
  A2: {
    listening: ["an appointment or a booking", "a weekend activity"],
    reading: ["a trip or a holiday", "a place to live"],
  },
  B1: {
    listening: ["a problem while traveling", "a sport, hobby or club"],
    reading: ["work or a new job", "a course or a class"],
  },
  B2: {
    listening: ["a product or service someone tried", "technology in daily life"],
    reading: ["a change at work or school", "a neighborhood or city issue"],
  },
  C1: {
    listening: [
      "a radio guest talking about their field",
      "someone looking back on a big decision",
    ],
    reading: [
      "a review of a book, film, show or restaurant",
      "an opinion column on how people live or work",
    ],
  },
} as const satisfies Record<TestLevel, Record<TestSkill, readonly string[]>>;

/* oxlint-disable eslint/sort-keys -- Structured output follows schema property order: what the question tests comes first, then the text, its question, the evidence for the answer, how a learner one level below would misread it, and the right option before the wrong ones. */
function createLevelSchema(level: TestLevel) {
  const questionSchema = z.object({
    tests: z.enum(QUESTION_TESTS[level]),
    passage: z.string(),
    question: z.string(),
    evidence: z.string(),
    lowerLevelMistake: z.string(),
    correctOption: z.string(),
    wrongOptions: z.array(z.string()).length(WRONG_OPTIONS),
  });

  return z.object({
    reading: z.array(questionSchema).length(QUESTIONS_PER_SKILL),
    listening: z.array(questionSchema).length(QUESTIONS_PER_SKILL),
    speaking: z.object({ sentence: z.string(), translation: z.string() }),
  });
}
/* oxlint-enable eslint/sort-keys */

type GeneratedLevel = z.infer<ReturnType<typeof createLevelSchema>>;
type GeneratedQuestion = GeneratedLevel["reading"][number];

type LevelTestQuestion = {
  skill: TestSkill;
  level: TestLevel;
  passage: string;
  question: string;
  options: string[];
  answerIndex: number;
};

export type GenerateLevelTestBankSchema = {
  questions: LevelTestQuestion[];
  speaking: { level: TestLevel; sentence: string; translation: string }[];
};

export type GenerateLevelTestBankParams = {
  targetLanguage: string;
  learnerLanguage: string;
  model?: string;
  useFallback?: boolean;
  reasoning?: Reasoning;
  analytics?: AiGenerationContext;
};

/**
 * Models tend to put the right answer in the same place, so code places it: by the question's
 * text, which spreads answers across positions without a sequence a learner could learn.
 */
function getAnswerIndex(question: GeneratedQuestion): number {
  const text = `${question.passage}${question.question}`;

  const sum = Array.from(
    { length: text.length },
    (_, index) => text.codePointAt(index) ?? 0,
  ).reduce((total, code) => total + code, 0);

  return sum % OPTIONS_PER_QUESTION;
}

function toTestQuestion({
  level,
  question,
  skill,
}: {
  level: TestLevel;
  question: GeneratedQuestion;
  skill: TestSkill;
}): LevelTestQuestion {
  const answerIndex = getAnswerIndex(question);
  const { correctOption, passage, wrongOptions } = question;

  return {
    answerIndex,
    level,
    options: wrongOptions.toSpliced(answerIndex, 0, correctOption),
    passage,
    question: question.question,
    skill,
  };
}

type WrittenLevel = { level: TestLevel; output: GeneratedLevel };

function toLevelTestBank(levels: readonly WrittenLevel[]): GenerateLevelTestBankSchema {
  return {
    questions: levels.flatMap(({ level, output }) =>
      TEST_SKILLS.flatMap((skill) =>
        output[skill].map((question) => toTestQuestion({ level, question, skill })),
      ),
    ),
    speaking: levels.map(({ level, output }) => ({ level, ...output.speaking })),
  };
}

function formatWords({ max, min }: WordRange): string {
  return `${min} to ${max}`;
}

function formatSituations(level: TestLevel): string {
  return TEST_SKILLS.flatMap((skill) =>
    SITUATIONS[level][skill].map((situation, index) => `- ${skill} ${index + 1}: ${situation}`),
  ).join("\n");
}

function buildLevelPrompt({
  languages,
  level,
}: {
  languages: ReturnType<typeof getLanguagePromptContext>;
  level: TestLevel;
}): string {
  const words = LEVEL_TEST_PASSAGE_WORDS[level];

  return `
TARGET_LANGUAGE: ${languages.targetLanguageName}
LEARNER_LANGUAGE: ${languages.userLanguageName}
LEVEL: ${level}
READING_WORDS: ${formatWords(words.reading)}
LISTENING_WORDS: ${formatWords(words.listening)}
SPEAKING_WORDS: ${SPEAKING_WORDS[level]}
SITUATIONS:
${formatSituations(level)}
`;
}

async function writeLevel({
  languages,
  level,
  params,
}: {
  languages: ReturnType<typeof getLanguagePromptContext>;
  level: TestLevel;
  params: GenerateLevelTestBankParams;
}) {
  const { analytics, model = defaultModel, reasoning, useFallback = true } = params;
  const userPrompt = buildLevelPrompt({ languages, level });
  const providerOptions = buildProviderOptions({ fallbackModels, model, useFallback });

  const { provenance, result } = await runTaskGeneration({
    analytics,
    generate: () =>
      generateText({
        instructions: systemPrompt,
        model,
        output: Output.object({ schema: createLevelSchema(level) }),
        prompt: userPrompt,
        providerOptions,
        reasoning,
      }),
    systemPrompt,
    task: "level-test-bank",
  });

  return { level, output: result.output, provenance, usage: result.usage, userPrompt };
}

/**
 * Writes the question bank for the three-minute level test of one language pair: two reading and
 * two listening questions per level from A1 to C1, and one sentence per level to say out loud.
 * Stored once and shared by every learner of that pair.
 */
export async function generateLevelTestBank(params: GenerateLevelTestBankParams) {
  const languages = getLanguagePromptContext({
    targetLanguage: params.targetLanguage,
    userLanguage: params.learnerLanguage,
  });

  // The levels are one job, so their calls share a trace unless the caller's job already has one.
  const analytics = { ...params.analytics, traceId: params.analytics?.traceId ?? randomUUID() };

  const levels = await Promise.all(
    TEST_LEVELS.map((level) => writeLevel({ languages, level, params: { ...params, analytics } })),
  );

  return {
    data: toLevelTestBank(levels),
    provenance: combineTaskProvenance(levels.map((level) => level.provenance)),
    systemPrompt,
    usage: sumLanguageModelUsage(levels.map((level) => level.usage)),
    userPrompt: levels.map((level) => level.userPrompt).join("\n"),
  };
}
