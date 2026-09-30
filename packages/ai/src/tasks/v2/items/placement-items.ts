import "server-only";
import { Output, generateText } from "ai";
import { z } from "zod";
import { type AiGenerationContext } from "../../../provenance/ai-generation-event";
import { runTaskGeneration } from "../../../provenance/run-task-generation";
import { type Reasoning, type ServiceTier, buildProviderOptions } from "../../../provider-options";
import { formatLocalContext } from "../../_utils/language-context";
import { getPromptLanguageName } from "../../_utils/prompt-language";
import { type CourseLevel } from "../curriculum/_utils/course-levels";
import { type ItemExamFormat } from "./generate-items";
import { withItemRules } from "./item-rules";
import { GENERATED_ITEM_SCHEMAS, type GeneratedItem } from "./item-schemas";
import taskPrompt from "./placement-items.prompt.md";

/**
 * The same writer as `generate-items`, whose eval chose Sol for correct keys and exam realism. On
 * the placement-items eval (3 cases of three skills, 30 Sep 2026) Sol scored 8.40 (ENEM 8.38,
 * Cebraspe true/false 8.73, SAT 8.08) with every key right, where single-skill writing of the
 * same skills scores 9.3–9.8. The judge's caps apply to the whole set: a typed question repeating
 * its skill's quick one, three false Cebraspe assertions and a duplicated accepted answer (the
 * prompt now rules these out), and one wrong distractor reason.
 */
const defaultModel = "openai/gpt-6-sol";
const fallbackModels = ["anthropic/claude-opus-5.5"] as const;

const systemPrompt = withItemRules(taskPrompt);

const DEFAULT_OPTION_COUNT = 4;

/** How placement asks quickly: one right option, or one assertion judged right or wrong. */
export type QuickItemFormat = "multipleChoice" | "trueFalse";

type PlacementItemsSkill = { name: string; description: string; level: CourseLevel };

export type PlacementItemsParams = {
  skills: PlacementItemsSkill[];
  quickFormat: QuickItemFormat;
  /** Quick questions per skill. */
  quickCount: number;
  /** Typed questions per skill, which confirm a right quick answer; 0 for quick questions only. */
  typedCount: number;
  language: string;
  examFormat?: ItemExamFormat | null;
  model?: string;
  /** The gateway tier it answers at (see `ServiceTier`); the standard one when unset. */
  serviceTier?: ServiceTier;
  useFallback?: boolean;
  reasoning?: Reasoning;
  analytics?: AiGenerationContext;
};

/** One skill's questions, in the order of the skills asked for; empty when the model left it out. */
export type PlacementSkillItems = { quick: GeneratedItem[]; typed: GeneratedItem[] };

function formatSkills(skills: readonly PlacementItemsSkill[]): string {
  return skills
    .map(
      (skill, index) =>
        `${index + 1}. SKILL: ${skill.name}\n   SKILL_DESCRIPTION: ${skill.description}\n   LEVEL: ${skill.level}`,
    )
    .join("\n");
}

function buildUserPrompt(params: PlacementItemsParams): string {
  const { examFormat } = params;

  return `
    QUICK_FORMAT: ${params.quickFormat}
    QUICK_COUNT: ${params.quickCount}
    TYPED_COUNT: ${params.typedCount}
    OPTION_COUNT: ${examFormat?.optionCount ?? DEFAULT_OPTION_COUNT}
    LANGUAGE: ${getPromptLanguageName({ language: params.language })}
${formatLocalContext(params.language)}
    FIELD: none
    EXAM: ${examFormat?.name ?? "none"}
    EXAM_STYLE: ${examFormat?.style ?? "none"}
    SKILLS:
${formatSkills(params.skills)}
  `;
}

/* oxlint-disable eslint/sort-keys -- Structured output follows schema property order: the model names the skill before writing about it. */
function buildSchema(quickFormat: QuickItemFormat) {
  return z.object({
    skills: z.array(
      z.object({
        skill: z.number().int(),
        quick: z.array(GENERATED_ITEM_SCHEMAS[quickFormat]),
        typed: z.array(GENERATED_ITEM_SCHEMAS.typed),
      }),
    ),
  });
}
/* oxlint-enable eslint/sort-keys */

/**
 * Writes placement's questions for several skills in one call: quick ones (multiple choice, or
 * the exam's true/false judgments) to ask each skill, and typed ones to confirm a right answer.
 * One call per few skills repeats the shared instructions far less than one call per skill and
 * format; a few skills per call keep each wait short, since output is written token by token.
 * Callers run the item checks in `@zoonk/core` before storing.
 */
export async function generatePlacementItems(params: PlacementItemsParams) {
  const {
    analytics,
    model = defaultModel,
    quickFormat,
    reasoning,
    serviceTier,
    skills,
    useFallback = true,
  } = params;

  const userPrompt = buildUserPrompt(params);
  const providerOptions = buildProviderOptions({ fallbackModels, model, serviceTier, useFallback });

  const { provenance, result } = await runTaskGeneration({
    analytics,
    generate: () =>
      generateText({
        instructions: systemPrompt,
        model,
        output: Output.object({ schema: buildSchema(quickFormat) }),
        prompt: userPrompt,
        providerOptions,
        reasoning,
      }),
    systemPrompt,
    task: "placement-items",
  });

  const written = new Map(result.output.skills.map((entry) => [entry.skill, entry]));

  const items: PlacementSkillItems[] = skills.map((_, index) => ({
    quick: written.get(index + 1)?.quick ?? [],
    typed: written.get(index + 1)?.typed ?? [],
  }));

  return { data: { skills: items }, provenance, systemPrompt, usage: result.usage, userPrompt };
}
