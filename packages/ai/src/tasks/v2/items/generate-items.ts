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
import { GENERATED_ITEM_SCHEMAS, type GeneratedItem, type ItemFormat } from "./item-schemas";

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

const systemPrompt = withItemRules(taskPrompt);

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
};

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
  const { examFormat, skill } = params;
  const count = Math.min(params.count ?? DEFAULT_COUNT, MAX_COUNT);

  return `
    FORMAT: ${params.format}
    COUNT: ${count}
    OPTION_COUNT: ${examFormat?.optionCount ?? DEFAULT_OPTION_COUNT}
    LEVEL: ${params.level}
    LANGUAGE: ${getPromptLanguageName({ language: params.language })}
    TARGET_LANGUAGE: none
${formatLocalContext(params.language)}
    ${formatCast({ language: params.language, seed: `${skill.name}:${params.format}` })}
    SKILL: ${skill.name}
    SKILL_DESCRIPTION: ${skill.description}
    SKILL_EXAMPLE: ${skill.example ?? "none"}
    FIELD: ${params.field ?? "none"}
    EXAM: ${examFormat?.name ?? "none"}
    EXAM_STYLE: ${examFormat?.style ?? "none"}
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
    systemPrompt,
    task: "generate-items",
  });

  const items: GeneratedItem[] = result.output.items;

  return { data: { items }, provenance, systemPrompt, usage: result.usage, userPrompt };
}
