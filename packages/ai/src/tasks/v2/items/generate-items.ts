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
import taskPrompt from "./generate-items.prompt.md";
import { withItemRules } from "./item-rules";
import {
  GENERATED_ITEM_SCHEMAS,
  type GeneratedItem,
  type ItemFormat,
  type NumericEntry,
  type OptionSelect,
} from "./item-schemas";
import { formatPastQuestions } from "./past-question-lines";

/**
 * Sol scored close to Opus on the generate-items eval at a quarter of the cost; Flash wrote wrong
 * keys and a medical error, so it isn't a fallback (Sep 2026).
 */
const defaultModel = "openai/gpt-6-sol";
const fallbackModels = ["anthropic/claude-opus-5.5"] as const;

const DEFAULT_COUNT = 4;
const MAX_COUNT = 10;
const DEFAULT_OPTION_COUNT = 4;

export type ItemExamFormat = {
  name: string;
  style: string;
  optionCount?: number | null;
  select?: OptionSelect | null;
  entry?: NumericEntry | null;
  /** Real questions allowed to be quoted, which new ones match in difficulty but never copy. */
  pastQuestions?: readonly string[] | null;
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

export type GenerateItemsParams = {
  skill: { name: string; description: string; example?: string | null };
  format: ItemFormat;
  level: CourseLevel;
  language: string;
  count?: number;
  /** Null for general items. */
  field?: string | null;
  examFormat?: ItemExamFormat | null;
  model?: string;
  serviceTier?: ServiceTier;
  useFallback?: boolean;
  reasoning?: Reasoning;
  analytics?: AiGenerationContext;
};

function buildUserPrompt(params: GenerateItemsParams): string {
  const { examFormat, field, format, skill } = params;
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

  return `
    FORMAT: ${format}
    COUNT: ${count}${optionCount}${select}${entryLine}
    LEVEL: ${params.level}
    LANGUAGE: ${getPromptLanguageName({ language: params.language })}
${formatLocalContext(params.language)}
    ${formatCast({ language: params.language, seed: `${skill.name}:${format}` })}
    SKILL: ${skill.name}
    SKILL_DESCRIPTION: ${skill.description}
    SKILL_EXAMPLE: ${skill.example ?? "none"}${fieldLine}
    EXAM: ${examFormat?.name ?? "none"}
    EXAM_STYLE: ${examFormat?.style ?? "none"}${formatPastQuestions(examFormat)}
  `;
}

/** Callers run the item checks in `@zoonk/core` before storing. */
export async function generateItems(params: GenerateItemsParams) {
  const {
    analytics,
    format,
    model = defaultModel,
    reasoning,
    serviceTier,
    useFallback = true,
  } = params;

  const userPrompt = buildUserPrompt(params);

  // No caller writes a language goal's questions with this task: placement-items writes those.
  const systemPrompt = withItemRules(taskPrompt, {
    field: Boolean(params.field),
    formats: [format],
    languageGoal: false,
    numericEntry: format === "numeric" && describeEntry(params.examFormat?.entry) !== null,
    severalPicks: format === "multipleChoice" && picksSeveral(params.examFormat),
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
    libraryInput: true,
    systemPrompt,
    task: "generate-items",
  });

  const items: GeneratedItem[] = result.output.items;

  return { data: { items }, provenance, systemPrompt, usage: result.usage, userPrompt };
}
