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
 * From the generate-items eval (8 cases, Sep 2026): Sol scored 9.05 at $16 per
 * 1,000 runs, Opus 5.5 9.25 at $58 and Gemini 3.8 Flash 8.25 with wrong keys
 * and a medical error, so it is not a fallback. Field practice (nursing and law
 * cases, 27 Sep 2026): Sol 9.2, right keys, set in the field without needing it.
 * Essay rubric points (27 Sep 2026): Sol wrote an AP Biology free-response
 * question with a whole point per requirement (8.35) and ENEM's five
 * competencies with no points of their own (9.04).
 */
const defaultModel = "openai/gpt-6-sol";
const fallbackModels = ["anthropic/claude-opus-5.5"] as const;

const DEFAULT_COUNT = 4;
const MAX_COUNT = 10;
const DEFAULT_OPTION_COUNT = 4;

/**
 * The part of an exam blueprint an item writer needs: its name and how its
 * questions look and score, such as "Cebraspe: one assertion judged right or
 * wrong, a wrong answer cancels a right one".
 */
export type ItemExamFormat = {
  name: string;
  style: string;
  /** Options per multiple-choice question, such as 5 for ENEM and 4 for the SAT. */
  optionCount?: number | null;
  /** How many options a multiple-choice question asks to pick: JEE Advanced's "one or more". */
  select?: OptionSelect | null;
  /** How a numeric answer is typed: the SAT's grid-ins, JEE Main's integers. */
  entry?: NumericEntry | null;
  /**
   * A few real questions from the exam's past papers (allowed to be quoted), as printed: what new
   * questions match in difficulty, length and steps, never copy. Empty or absent without any.
   */
  pastQuestions?: readonly string[] | null;
};

/** Whether the exam asks to pick several options, not one (`SELECT`). */
function picksSeveral(examFormat: ItemExamFormat | null | undefined): boolean {
  return Boolean(examFormat?.select) && examFormat?.select !== 1;
}

/** The `ENTRY` line's value for an answer box that takes less than any number, or null. */
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
  /** The learner's work ("nursing"), so practice is set in it. Null for general items. */
  field?: string | null;
  examFormat?: ItemExamFormat | null;
  model?: string;
  /** The gateway tier it answers at (see `ServiceTier`); the standard one when unset. */
  serviceTier?: ServiceTier;
  useFallback?: boolean;
  reasoning?: Reasoning;
  analytics?: AiGenerationContext;
};

function buildUserPrompt(params: GenerateItemsParams): string {
  const { examFormat, field, format, skill } = params;
  const count = Math.min(params.count ?? DEFAULT_COUNT, MAX_COUNT);

  // Only multiple-choice questions have options, and only a field's questions are set in it.
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

/**
 * Writes practice and exam items for one skill in one format: a reason and a
 * misconception for every wrong option, key points for typed and spoken
 * answers, and math problems as data so code can recompute answers and make
 * new numbers. Callers run the item checks in `@zoonk/core` before storing.
 */
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
