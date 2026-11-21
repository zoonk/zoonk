import "server-only";
import { Output, generateText } from "ai";
import { z } from "zod";
import { type AiGenerationContext } from "../../provenance/ai-generation-event";
import { runTaskGeneration } from "../../provenance/run-task-generation";
import { type Reasoning, type ServiceTier, buildProviderOptions } from "../../provider-options";
import { getPromptLanguageName } from "../_utils/prompt-language";
import { selectPromptVariants } from "../_utils/prompt-variants";
import { type CourseLevel } from "../curriculum/_utils/course-levels";
import taskPrompt from "./generate-items.prompt.md";
import { withItemRules } from "./item-rules";
import {
  GENERATED_ITEM_SCHEMAS,
  type GeneratedItem,
  type ItemFormat,
  type NumericEntry,
  type OptionSelect,
} from "./item-schemas";
import { formatItemSetting } from "./item-setting";
import { formatPastQuestions } from "./past-question-lines";
import { formatUsedSituations, getSituationSeed } from "./used-situations";

/**
 * On 28 cases (8 Nov 2026), Terra scored 9.09 (EN 9.22, PT 8.92) at $10.00/1k; Luna (8.71),
 * Haiku 5.5 (8.46) and Flash Lite (7.66) cost less but wrote wrong keys or facts, and Flash Lite
 * reversed a missed-dose instruction. Opus hasn't run the current prompt. Gemini 4 Hydrogen scored
 * 8.79 to Terra's 9.14 at $94.54/1k against $9.77/1k, with 11 of 83 items flagged (18 Nov 2026).
 */
const defaultModel = "openai/gpt-6.1-terra";

/**
 * A mock must be as hard as the board's released questions. On the generate-mock-items eval (4
 * Cebraspe cases blind-mixed with released 2022 items, 20 Nov 2026), Sol 6.2 rated as hard in 11 of
 * 12 runs (+0.08 on a 1-5 scale) at $18.12/1k with 98% of keys reproduced, and the one disputed
 * key was right. Terra rated easier (5 of 12, -0.58) at $8.11/1k. Opus 5.5 (6 of 8, -0.21) and
 * Gemini 4 Hydrogen (6 of 8, 92% of keys) cost $96/1k.
 */
const mockModel = "openai/gpt-6.2-sol";
const fallbackModels = ["anthropic/claude-opus-5.5"] as const;

const DEFAULT_COUNT = 4;
const MAX_COUNT = 10;
const DEFAULT_OPTION_COUNT = 4;

export type ItemExamFormat = {
  name: string | null;
  style: string;
  optionCount?: number | null;
  select?: OptionSelect | null;
  entry?: NumericEntry | null;
  /** Real questions allowed to be quoted, which new ones match in difficulty but never copy. */
  pastQuestions?: readonly string[] | null;
  /** The share of a right answer's points each wrong answer takes away (1 when one cancels a right one); a mock writes for it. */
  wrongPenalty?: number | null;
};

function picksSeveral(examFormat: ItemExamFormat | null | undefined): boolean {
  return Boolean(examFormat?.select) && examFormat?.select !== 1;
}

function describeEntry(entry: NumericEntry | null | undefined): string | null {
  if (!entry || entry.kind === "number") {
    return null;
  }

  return entry.kind === "decimals" ? `decimals: ${entry.places ?? 0}` : entry.kind;
}

type ItemPurpose = "practice" | "mock";

export type GenerateItemsParams = {
  skill: { name: string; description: string; example?: string | null };
  format: ItemFormat;
  purpose?: ItemPurpose;
  level: CourseLevel;
  language: string;
  /** The country the skills are set in; null is the language's own. */
  country: string | null;
  /** A language exam's questions practice it. */
  targetLanguage?: string | null;
  count?: number;
  /** Null for general items. */
  field?: string | null;
  examFormat?: ItemExamFormat | null;
  usedSituations?: readonly string[];
  model?: string;
  serviceTier?: ServiceTier;
  useFallback?: boolean;
  reasoning?: Reasoning;
  analytics?: AiGenerationContext;
};

/** A named exam's mock takes its difficulty from the exam, never from the lesson level. */
function readsLevel({ examFormat, purpose }: GenerateItemsParams): boolean {
  return purpose !== "mock" || !examFormat;
}

function getWrongPenalty({ examFormat, purpose }: GenerateItemsParams): number | null {
  const penalty = examFormat?.wrongPenalty ?? 0;
  return purpose === "mock" && penalty > 0 ? penalty : null;
}

function formatWrongPenalty(params: GenerateItemsParams): string {
  const penalty = getWrongPenalty(params);

  return penalty === null
    ? ""
    : `\n    WRONG_ANSWER_COST: ${Math.round(penalty * 100)}% of a right answer's points`;
}

function buildUserPrompt(params: GenerateItemsParams): string {
  const { examFormat, field, format, skill, usedSituations } = params;
  const seed = `${getSituationSeed([{ name: skill.name, usedSituations }])}:${format}`;
  const count = Math.min(params.count ?? DEFAULT_COUNT, MAX_COUNT);

  const optionCount =
    format === "multipleChoice"
      ? `\n    OPTION_COUNT: ${examFormat?.optionCount ?? DEFAULT_OPTION_COUNT}`
      : "";

  const select =
    format === "multipleChoice" && picksSeveral(examFormat)
      ? `\n    SELECT: ${examFormat?.select}`
      : "";

  const entry = format === "numeric" ? describeEntry(examFormat?.entry) : null;
  const entryLine = entry ? `\n    ENTRY: ${entry}` : "";
  const fieldLine = field ? `\n    FIELD: ${field}` : "";
  const levelLine = readsLevel(params) ? `\n    LEVEL: ${params.level}` : "";

  return `
    FORMAT: ${format}
    COUNT: ${count}${optionCount}${select}${entryLine}${levelLine}
    LANGUAGE: ${getPromptLanguageName({ language: params.language })}
${formatItemSetting({ country: params.country, language: params.language, seed, targetLanguage: params.targetLanguage })}
    SKILL: ${skill.name}
    SKILL_DESCRIPTION: ${skill.description}
    SKILL_EXAMPLE: ${skill.example ?? "none"}${fieldLine}
    EXAM: ${examFormat?.name ?? "none"}
    EXAM_STYLE: ${examFormat?.style ?? "none"}${formatWrongPenalty(params)}${formatPastQuestions(examFormat)}${formatUsedSituations({ indent: "    ", situations: usedSituations })}
  `;
}

/** Callers run the item checks in `@zoonk/core` before storing. */
export async function generateItems(params: GenerateItemsParams) {
  const {
    analytics,
    format,
    model = params.purpose === "mock" ? mockModel : defaultModel,
    reasoning,
    serviceTier,
    useFallback = true,
  } = params;

  const userPrompt = buildUserPrompt(params);

  const mock = params.purpose === "mock";
  const usedSituations = Boolean(params.usedSituations?.length);

  const instructions = selectPromptVariants({
    template: taskPrompt,
    variants: {
      mock,
      practice: !mock,
      usedSituations,
      wrongPenalty: getWrongPenalty(params) !== null,
    },
  });

  const systemPrompt = withItemRules(instructions, {
    field: Boolean(params.field),
    formats: [format],
    languageGoal: Boolean(params.targetLanguage),
    mock,
    numericEntry: format === "numeric" && describeEntry(params.examFormat?.entry) !== null,
    severalPicks: format === "multipleChoice" && picksSeveral(params.examFormat),
    usedSituations,
  });

  const schema = z.object({ items: z.array(GENERATED_ITEM_SCHEMAS[format]) });
  const providerOptions = buildProviderOptions({ fallbackModels, model, serviceTier, useFallback });

  const { provenance, result } = await runTaskGeneration({
    analytics,
    generate: () =>
      generateText({
        instructions: systemPrompt,
        model,
        output: Output.object({ schema }),
        prompt: userPrompt,
        providerOptions,
        reasoning,
      }),
    libraryInput: !mock,
    systemPrompt,
    task: "generate-items",
  });

  const items: GeneratedItem[] = result.output.items;

  return { data: { items }, provenance, systemPrompt, usage: result.usage, userPrompt };
}
