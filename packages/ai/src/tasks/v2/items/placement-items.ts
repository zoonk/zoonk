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
import { type ItemExamFormat } from "./generate-items";
import { withItemRules } from "./item-rules";
import { GENERATED_ITEM_SCHEMAS, type GeneratedItem, type ItemFormat } from "./item-schemas";
import trueFalseBalance from "./placement-items-true-false.prompt.md";
import typedAnswers from "./placement-items-typed-answers.prompt.md";
import typedCheck from "./placement-items-typed-check.prompt.md";
import taskPrompt from "./placement-items.prompt.md";

/**
 * Sol wrote every key right on the placement-items eval; Luna and Haiku scored lower, and GPT-6.1
 * Sol was within noise at twice the wait (13 Oct 2026).
 */
const defaultModel = "openai/gpt-6-sol";
const fallbackModels = ["anthropic/claude-opus-5.5"] as const;

const DEFAULT_OPTION_COUNT = 4;

const TYPED_GOAL = " and exactly `TYPED_COUNT` in the `typed` format";

type QuickItemFormat = "multipleChoice" | "trueFalse";

type PlacementItemsSkill = {
  name: string;
  description: string;
  level: CourseLevel;
  /** So the new questions use other situations: a mock never asks the same case under new names. */
  usedSituations?: readonly string[];
};

export type PlacementItemsParams = {
  skills: PlacementItemsSkill[];
  quickFormat: QuickItemFormat;
  quickCount: number;
  /** They confirm a right quick answer; 0 for quick questions only. */
  typedCount: number;
  language: string;
  /** A language goal's questions are written in it. */
  targetLanguage?: string | null;
  examFormat?: ItemExamFormat | null;
  model?: string;
  serviceTier?: ServiceTier;
  useFallback?: boolean;
  reasoning?: Reasoning;
  analytics?: AiGenerationContext;
};

/** In the order of the skills asked for; empty when the model left one out. */
export type PlacementSkillItems = { quick: GeneratedItem[]; typed: GeneratedItem[] };

type WrittenSkill = { skill: number; quick: GeneratedItem[]; typed?: GeneratedItem[] };

function formatUsedSituations(situations: readonly string[] | undefined): string {
  return situations?.length
    ? situations.map((situation) => `\n     - ${situation}`).join("")
    : " none";
}

function formatSkills(skills: readonly PlacementItemsSkill[]): string {
  return skills
    .map(
      (skill, index) =>
        `${index + 1}. SKILL: ${skill.name}\n   SKILL_DESCRIPTION: ${skill.description}\n   LEVEL: ${skill.level}\n   USED_SITUATIONS:${formatUsedSituations(skill.usedSituations)}`,
    )
    .join("\n");
}

function buildTaskPrompt({ quickFormat, typedCount }: PlacementItemsParams): string {
  const writesTyped = typedCount > 0;

  return taskPrompt
    .replace("{{TYPED_GOAL}}", () => (writesTyped ? TYPED_GOAL : ""))
    .replace("{{TYPED_CHECK}}\n", () => (writesTyped ? typedCheck : ""))
    .replace("{{TRUE_FALSE_BALANCE}}\n", () =>
      quickFormat === "trueFalse" ? trueFalseBalance : "",
    )
    .replace("{{TYPED_ANSWERS}}\n", () => (writesTyped ? typedAnswers : ""));
}

function buildSystemPrompt(params: PlacementItemsParams): string {
  const formats: ItemFormat[] =
    params.typedCount > 0 ? [params.quickFormat, "typed"] : [params.quickFormat];

  return withItemRules(buildTaskPrompt(params), {
    field: false,
    formats,
    languageGoal: Boolean(params.targetLanguage),
  });
}

function buildUserPrompt(params: PlacementItemsParams): string {
  const { examFormat, language, quickFormat, targetLanguage, typedCount } = params;

  const typedLine = typedCount > 0 ? `\n    TYPED_COUNT: ${typedCount}` : "";

  const optionCount =
    quickFormat === "multipleChoice"
      ? `\n    OPTION_COUNT: ${examFormat?.optionCount ?? DEFAULT_OPTION_COUNT}`
      : "";

  const targetLanguageLine = targetLanguage
    ? `\n    TARGET_LANGUAGE: ${getPromptLanguageName({ language: targetLanguage, userLanguage: language })}`
    : "";

  return `
    QUICK_FORMAT: ${quickFormat}
    QUICK_COUNT: ${params.quickCount}${typedLine}${optionCount}
    LANGUAGE: ${getPromptLanguageName({ language })}${targetLanguageLine}
${formatLocalContext(language)}
    ${formatCast({ language, seed: params.skills.map((skill) => skill.name).join(":") })}
    EXAM: ${examFormat?.name ?? "none"}
    EXAM_STYLE: ${examFormat?.style ?? "none"}
    SKILLS:
${formatSkills(params.skills)}
  `;
}

/* oxlint-disable eslint/sort-keys -- Structured output follows schema property order: the model names the skill before writing about it. */
function buildSchema({ quickFormat, typedCount }: PlacementItemsParams) {
  const quick = { skill: z.number().int(), quick: z.array(GENERATED_ITEM_SCHEMAS[quickFormat]) };

  return z.object({
    skills: z.array(
      typedCount > 0
        ? z.object({ ...quick, typed: z.array(GENERATED_ITEM_SCHEMAS.typed) })
        : z.object(quick),
    ),
  });
}
/* oxlint-enable eslint/sort-keys */

/**
 * A few skills per call repeat the shared instructions far less than one call per skill, and keep
 * each wait short. Callers run the item checks in `@zoonk/core` before storing.
 */
export async function generatePlacementItems(params: PlacementItemsParams) {
  const {
    analytics,
    model = defaultModel,
    reasoning,
    serviceTier,
    skills,
    useFallback = true,
  } = params;

  const systemPrompt = buildSystemPrompt(params);
  const userPrompt = buildUserPrompt(params);
  const providerOptions = buildProviderOptions({ fallbackModels, model, serviceTier, useFallback });

  const { provenance, result } = await runTaskGeneration({
    analytics,
    generate: () =>
      generateText({
        instructions: systemPrompt,
        model,
        output: Output.object({ schema: buildSchema(params) }),
        prompt: userPrompt,
        providerOptions,
        reasoning,
      }),
    libraryInput: true,
    systemPrompt,
    task: "placement-items",
  });

  // Without typed questions to write, the answer has no `typed` list.
  const written = new Map<number, WrittenSkill>(
    result.output.skills.map((entry) => [entry.skill, entry]),
  );

  const items: PlacementSkillItems[] = skills.map((_, index) => ({
    quick: written.get(index + 1)?.quick ?? [],
    typed: written.get(index + 1)?.typed ?? [],
  }));

  return { data: { skills: items }, provenance, systemPrompt, usage: result.usage, userPrompt };
}
