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
 * The same writer as `generate-items`, whose eval chose Sol for correct keys and exam realism. On
 * the placement-items eval (3 cases of three skills, 30 Sep 2026) Sol scored 8.40 (ENEM 8.38,
 * Cebraspe true/false 8.73, SAT 8.08) with every key right, where single-skill writing of the
 * same skills scores 9.3–9.8. The judge's caps apply to the whole set: a typed question repeating
 * its skill's quick one, three false Cebraspe assertions and a duplicated accepted answer (the
 * prompt now rules these out), and one wrong distractor reason. The two cheapest, on 4 cases
 * (7 Oct 2026): Luna 7.96 and Claude Haiku 5.5 7.46 (one set failed) against Sol's 8.90, at $2 and
 * $2.50 per 1,000 runs against $40.
 */
const defaultModel = "openai/gpt-6-sol";
const fallbackModels = ["anthropic/claude-opus-5.5"] as const;

const DEFAULT_OPTION_COUNT = 4;

/** The goal's clause for the typed questions that confirm a right quick answer. */
const TYPED_GOAL = " and exactly `TYPED_COUNT` in the `typed` format";

/** How placement asks quickly: one right option, or one assertion judged right or wrong. */
type QuickItemFormat = "multipleChoice" | "trueFalse";

type PlacementItemsSkill = {
  name: string;
  description: string;
  level: CourseLevel;
  /**
   * The situations the skill's questions in the bank already use (their opening words), so the
   * new ones put the skill in others: a mock never asks the same case twice under new names.
   */
  usedSituations?: readonly string[];
};

export type PlacementItemsParams = {
  skills: PlacementItemsSkill[];
  quickFormat: QuickItemFormat;
  /** Quick questions per skill. */
  quickCount: number;
  /** Typed questions per skill, which confirm a right quick answer; 0 for quick questions only. */
  typedCount: number;
  language: string;
  /** The language a language goal's skills practice ("en"); its questions are in it. */
  targetLanguage?: string | null;
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

/**
 * The writer's own rules, with the typed questions' only when it writes them (placement's
 * confirmations; mocks, focus tests and test-outs ask quick questions alone) and the true/false
 * balance only for true/false questions.
 */
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

  // Each line only when something the call reads refers to it.
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
 * Writes the bank's questions for several skills in one call: quick ones (multiple choice, or
 * the exam's true/false judgments) to ask each skill, and, for placement, typed ones to confirm a
 * right answer. Mocks, focus tests and test-outs ask for quick ones alone.
 * One call per few skills repeats the shared instructions far less than one call per skill and
 * format; a few skills per call keep each wait short, since output is written token by token.
 * Callers run the item checks in `@zoonk/core` before storing.
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
