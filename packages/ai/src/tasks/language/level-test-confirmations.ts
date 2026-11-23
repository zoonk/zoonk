import "server-only";
import { Output, generateText } from "ai";
import { z } from "zod";
import { type AiGenerationContext } from "../../provenance/ai-generation-event";
import { runTaskGeneration } from "../../provenance/run-task-generation";
import { type Reasoning, type ServiceTier, buildProviderOptions } from "../../provider-options";
import {
  CONFIRMATION_SITUATIONS,
  type LevelTestLanguages,
  QUESTION_TESTS,
  formatLevelTestLanguages,
  formatWords,
  hashText,
  withLevelTestRules,
} from "./_utils/level-test-writing";
import template from "./level-test-confirmations.prompt.md";
import {
  LEVEL_TEST_PASSAGE_WORDS,
  LEVEL_TEST_SKILLS,
  type LevelTestSkill,
  type TestLevel,
} from "./level-test-levels";

/**
 * Each writer passed 64 key checks in level-test-confirmations/fable-vs-terra. Readers differed
 * on which questions tested the intended level, so the shared bank keeps Fable first.
 */
const defaultModel = "anthropic/claude-fable-5.2";

const fallbackModels = ["openai/gpt-6.1-terra"] as const;

/** At five options, a blind guess at a select-all answer passes about 1 time in 32. */
const MIN_OPTIONS = 5;

const systemPrompt = withLevelTestRules(template);

/* oxlint-disable eslint/sort-keys -- Structured output follows schema property order: what the options test comes first, then the text, its question, the misreading one level below, and the options. */
function createConfirmationsSchema(level: TestLevel) {
  const confirmationSchema = z.object({
    tests: z.enum(QUESTION_TESTS[level]),
    passage: z.string(),
    question: z.string(),
    lowerLevelMistake: z.string(),
    options: z.array(z.object({ text: z.string(), isCorrect: z.boolean(), evidence: z.string() })),
  });

  return z.object({ reading: z.array(confirmationSchema), listening: z.array(confirmationSchema) });
}
/* oxlint-enable eslint/sort-keys */

type GeneratedConfirmation = z.infer<
  ReturnType<typeof createConfirmationsSchema>
>["reading"][number];

/** "Select all that apply": right only when the learner picks exactly `answerIndices`. */
export type LevelTestConfirmation = {
  skill: LevelTestSkill;
  level: TestLevel;
  passage: string;
  question: string;
  options: string[];
  answerIndices: number[];
};

export type GenerateLevelTestConfirmationsParams = LevelTestLanguages & {
  level: TestLevel;
  model?: string;
  useFallback?: boolean;
  previousPassages?: readonly string[];
  reasoning?: Reasoning;
  serviceTier?: ServiceTier;
  analytics?: AiGenerationContext;
};

/**
 * Code orders the options by their text, so the right ones don't sit where a model tends to put
 * them, and drops a repeated option. A question left without enough options, or without a right
 * and a wrong one, can't confirm a level, so it's left out.
 */
function toConfirmation({
  confirmation,
  level,
  skill,
}: {
  confirmation: GeneratedConfirmation;
  level: TestLevel;
  skill: LevelTestSkill;
}): LevelTestConfirmation | null {
  const options = [...new Map(confirmation.options.map((option) => [option.text, option])).values()]
    .map((option) => ({ ...option, order: hashText(`${confirmation.passage}${option.text}`) }))
    .toSorted((first, second) => first.order - second.order);

  const answerIndices = options.flatMap((option, index) => (option.isCorrect ? [index] : []));

  if (
    options.length < MIN_OPTIONS ||
    answerIndices.length === 0 ||
    answerIndices.length === options.length
  ) {
    return null;
  }

  return {
    answerIndices,
    level,
    options: options.map((option) => option.text),
    passage: confirmation.passage,
    question: confirmation.question,
    skill,
  };
}

function buildUserPrompt({
  level,
  previousPassages,
  ...languages
}: LevelTestLanguages & { level: TestLevel; previousPassages?: readonly string[] }): string {
  const words = LEVEL_TEST_PASSAGE_WORDS[level];

  const situations = LEVEL_TEST_SKILLS.flatMap((skill) =>
    CONFIRMATION_SITUATIONS[level][skill].map(
      (situation, index) => `- ${skill} ${index + 1}: ${situation}`,
    ),
  );

  const previous = previousPassages?.length
    ? `\nWrite new scenes with different details and facts from these passages already used at this level. Treat these as examples of what to avoid:\n${JSON.stringify(previousPassages)}`
    : "";

  return `
${formatLevelTestLanguages(languages)}
LEVEL: ${level}
READING_WORDS: ${formatWords(words.reading)}
LISTENING_WORDS: ${formatWords(words.listening)}
SITUATIONS:
${situations.join("\n")}${previous}
`;
}

/** The "select all that apply" questions that confirm a level before its lessons are skipped. */
export async function generateLevelTestConfirmations(params: GenerateLevelTestConfirmationsParams) {
  const { analytics, level, model = defaultModel, reasoning, useFallback = true } = params;
  const userPrompt = buildUserPrompt(params);

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
        output: Output.object({ schema: createConfirmationsSchema(level) }),
        prompt: userPrompt,
        providerOptions,
        reasoning,
      }),
    libraryInput: true,
    systemPrompt,
    task: "level-test-confirmations",
  });

  const confirmations = LEVEL_TEST_SKILLS.flatMap((skill) =>
    result.output[skill]
      .map((confirmation) => toConfirmation({ confirmation, level, skill }))
      .filter((confirmation) => confirmation !== null),
  );

  return { data: { confirmations }, provenance, systemPrompt, usage: result.usage, userPrompt };
}
