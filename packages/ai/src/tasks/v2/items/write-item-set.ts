import "server-only";
import { Output, generateText } from "ai";
import { z } from "zod";
import { type AiGenerationContext } from "../../../provenance/ai-generation-event";
import { runTaskGeneration } from "../../../provenance/run-task-generation";
import { type Reasoning, type ServiceTier, buildProviderOptions } from "../../../provider-options";
import { formatCast } from "../../_utils/cast";
import { formatLocalContext } from "../../_utils/language-context";
import { getPromptLanguageName } from "../../_utils/prompt-language";
import { type CourseLevel } from "../curriculum/_utils/course-levels";
import { lessonVisualSchema } from "../visuals/visual-schema";
import { type ItemExamFormat } from "./generate-items";
import { withItemRules } from "./item-rules";
import { GENERATED_ITEM_SCHEMAS, type GeneratedItem } from "./item-schemas";
import { formatPastQuestions } from "./past-question-lines";
import taskPrompt from "./write-item-set.prompt.md";

/** The item writer's model and fallback: a set's questions follow the same rules as the bank's. */
const defaultModel = "openai/gpt-6-sol";
const fallbackModels = ["anthropic/claude-opus-5.5"] as const;

const DEFAULT_OPTION_COUNT = 4;
const MIN_QUESTIONS = 2;
const MAX_QUESTIONS = 5;

/** How a set's questions are asked: options to choose, or statements judged right or wrong. */
export type ItemSetFormat = "multipleChoice" | "trueFalse";

/** What a set's stimulus is: a passage, a case to analyze, or data the app draws. */
const ITEM_SET_KINDS = ["text", "case", "chart"] as const;

type ItemSetSkill = { name: string; description: string; level: CourseLevel };

export type WriteItemSetParams = {
  /** Two to four skills of one subject the set's questions test. */
  skills: ItemSetSkill[];
  format: ItemSetFormat;
  questionCount: number;
  language: string;
  examFormat?: ItemExamFormat | null;
  /** Titles of the sets these skills already have, so a new one is about something else. */
  usedTitles?: readonly string[];
  model?: string;
  /** The gateway tier it answers at (see `ServiceTier`); the standard one when unset. */
  serviceTier?: ServiceTier;
  useFallback?: boolean;
  reasoning?: Reasoning;
  analytics?: AiGenerationContext;
};

/** A set's question is about its stimulus, so it shows no support text, chart or picture of its own. */
const SET_SHOWS = { context: true, image: true, visual: true } as const;

/* oxlint-disable eslint/sort-keys -- Structured output follows schema property order: the stimulus comes before its questions, and each question's skill and evidence before the question written from them. */
const SET_QUESTION_SCHEMAS = {
  multipleChoice: GENERATED_ITEM_SCHEMAS.multipleChoice.omit(SET_SHOWS),
  trueFalse: GENERATED_ITEM_SCHEMAS.trueFalse.omit(SET_SHOWS),
} as const satisfies Record<ItemSetFormat, z.ZodObject>;

function buildSchema(format: ItemSetFormat) {
  return z.object({
    kind: z.enum(ITEM_SET_KINDS),
    title: z.string().nullable(),
    text: z.string(),
    visual: lessonVisualSchema.nullable(),
    questions: z.array(
      z.object({
        skill: z.number().int(),
        evidence: z.string(),
        ...SET_QUESTION_SCHEMAS[format].shape,
      }),
    ),
  });
}
/* oxlint-enable eslint/sort-keys */

export type WrittenItemSet = z.infer<ReturnType<typeof buildSchema>>;

export type WrittenSetQuestion = WrittenItemSet["questions"][number];

/**
 * A set's question as the item bank stores it: without its skill number (the item's skill) or
 * its evidence (code's check), with no support text, chart or picture of its own.
 */
export function toSetItem(question: WrittenSetQuestion): GeneratedItem {
  const { evidence: _evidence, skill: _skill, ...item } = question;

  return GENERATED_ITEM_SCHEMAS[item.format].parse({
    ...item,
    context: null,
    image: null,
    visual: null,
  });
}

function formatSkills(skills: readonly ItemSetSkill[]): string {
  return skills
    .map(
      (skill, index) =>
        `${index + 1}. SKILL: ${skill.name}\n   SKILL_DESCRIPTION: ${skill.description}\n   LEVEL: ${skill.level}`,
    )
    .join("\n");
}

function buildUserPrompt(params: WriteItemSetParams): string {
  const { examFormat, format, language, skills } = params;
  const questionCount = Math.min(Math.max(params.questionCount, MIN_QUESTIONS), MAX_QUESTIONS);

  // Each line only when something the call reads refers to it.
  const optionCount =
    format === "multipleChoice"
      ? `\n    OPTION_COUNT: ${examFormat?.optionCount ?? DEFAULT_OPTION_COUNT}`
      : "";

  const usedTitles = params.usedTitles?.length
    ? `\n    USED_TITLES: ${params.usedTitles.join(" | ")}`
    : "";

  return `
    FORMAT: ${format}
    QUESTION_COUNT: ${questionCount}${optionCount}
    LANGUAGE: ${getPromptLanguageName({ language })}
${formatLocalContext(language)}
    ${formatCast({ language, seed: skills.map((skill) => skill.name).join(":") })}
    EXAM: ${examFormat?.name ?? "none"}
    EXAM_STYLE: ${examFormat?.style ?? "none"}${formatPastQuestions(examFormat)}${usedTitles}
    SKILLS:
${formatSkills(skills)}
  `;
}

/**
 * Writes one question set: a stimulus (an original passage, a case, or a chart's data) and several
 * questions on it, each testing one of the skills, in the exam's quick format. Shared Library
 * content: the prompt holds the exam and the skills, never a learner's words. Callers run the
 * set's checks and the item checks in `@zoonk/core` before storing.
 */
export async function writeItemSet(params: WriteItemSetParams) {
  const {
    analytics,
    format,
    model = defaultModel,
    reasoning,
    serviceTier,
    useFallback = true,
  } = params;

  // The questions share the stimulus's chart; the prompt's own rules describe it.
  const systemPrompt = withItemRules(taskPrompt, {
    field: false,
    formats: [format],
    languageGoal: false,
    pictures: false,
  });

  const userPrompt = buildUserPrompt(params);
  const providerOptions = buildProviderOptions({ fallbackModels, model, serviceTier, useFallback });

  const { provenance, result } = await runTaskGeneration({
    analytics,
    generate: () =>
      generateText({
        instructions: systemPrompt,
        model,
        output: Output.object({ schema: buildSchema(format) }),
        prompt: userPrompt,
        providerOptions,
        reasoning,
      }),
    libraryInput: true,
    systemPrompt,
    task: "write-item-set",
  });

  const data: WrittenItemSet = result.output;

  return { data, provenance, systemPrompt, usage: result.usage, userPrompt };
}
