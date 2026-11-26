import "server-only";
import { Output, generateText } from "ai";
import { z } from "zod";
import { type AiGenerationContext } from "../../provenance/ai-generation-event";
import { runTaskGeneration } from "../../provenance/run-task-generation";
import { type Reasoning, type ServiceTier, buildProviderOptions } from "../../provider-options";
import { getPromptLanguageName } from "../_utils/prompt-language";
import { selectPromptVariants } from "../_utils/prompt-variants";
import { type CourseLevel } from "../curriculum/_utils/course-levels";
import { type ItemExamFormat } from "./generate-items";
import { withItemRules } from "./item-rules";
import { GENERATED_ITEM_SCHEMAS, type GeneratedItem, type ItemFormat } from "./item-schemas";
import { formatItemSetting } from "./item-setting";
import taskPrompt from "./placement-items.prompt.md";
import { formatUsedSituations, getSituationSeed } from "./used-situations";

/**
 * Placement questions are kept per skill and reused, so right keys outweigh a longer first wait: on
 * 10 cases (8 Nov 2026), Terra at high reasoning scored 8.86 (EN 9.38, PT 8.73) at $25.52/1k
 * against Luna's 8.34, but still keyed one energy bill wrong. Opus hasn't run the current prompt.
 */
const defaultModel = "openai/gpt-6.1-terra";
const defaultReasoning: Reasoning = "high";
const fallbackModels = ["anthropic/claude-opus-5.5"] as const;

const DEFAULT_OPTION_COUNT = 4;

/** Below these, a blind guess passes more than 1 time in 20 (`isLowGuessTap` in `@zoonk/core`). */
const MIN_TAP_PAIRS = 4;
const MIN_TAP_STEPS = 4;
const MIN_TAP_OPTIONS = 5;

type QuickItemFormat = "multipleChoice" | "trueFalse";

type PlacementItemsSkill = {
  name: string;
  description: string;
  level: CourseLevel;
  quickCount: number;
  /** Low-guess questions that confirm a right quick answer wasn't luck. */
  tapCount: number;
  /** So the new questions use other situations: a mock never asks the same case under new names. */
  usedSituations?: readonly string[];
};

export type PlacementItemsParams = {
  skills: PlacementItemsSkill[];
  quickFormat: QuickItemFormat;
  language: string;
  /** The country the skills are set in; null is the language's own. */
  country: string | null;
  /** A language goal's questions are written in it. */
  targetLanguage?: string | null;
  examFormat?: ItemExamFormat | null;
  model?: string;
  serviceTier?: ServiceTier;
  useFallback?: boolean;
  reasoning?: Reasoning;
  analytics?: AiGenerationContext;
};

/**
 * In the order of the skills asked for; empty when the model left one out. A `multipleChoice`
 * tap question is "select all that apply".
 */
export type PlacementSkillItems = { quick: GeneratedItem[]; taps: GeneratedItem[] };

/* oxlint-disable eslint/sort-keys -- Structured output follows schema property order: the situation and question come before the answers. */
const tapSchema = z.discriminatedUnion("format", [
  GENERATED_ITEM_SCHEMAS.order.extend({ steps: z.array(z.string()).min(MIN_TAP_STEPS) }),
  GENERATED_ITEM_SCHEMAS.matchPairs.extend({
    pairs: GENERATED_ITEM_SCHEMAS.matchPairs.shape.pairs.element.array().min(MIN_TAP_PAIRS),
  }),
  z.object({
    format: z.literal("selectAll"),
    difficulty: GENERATED_ITEM_SCHEMAS.multipleChoice.shape.difficulty,
    context: z.string().nullable(),
    question: z.string(),
    options: GENERATED_ITEM_SCHEMAS.multipleChoice.shape.options.element
      .array()
      .min(MIN_TAP_OPTIONS),
  }),
]);
/* oxlint-enable eslint/sort-keys */

type WrittenTap = z.infer<typeof tapSchema>;

type WrittenSkill = { skill: number; quick?: GeneratedItem[]; taps?: WrittenTap[] };

function toTapItem(tap: WrittenTap): GeneratedItem {
  if (tap.format !== "selectAll") {
    return tap;
  }

  const { context, difficulty, options, question } = tap;

  return {
    context,
    difficulty,
    fixedOrder: false,
    format: "multipleChoice",
    image: null,
    options,
    question,
    visual: null,
  };
}

function getWrites(skills: readonly PlacementItemsSkill[]) {
  return {
    quick: skills.some((skill) => skill.quickCount > 0),
    taps: skills.some((skill) => skill.tapCount > 0),
  };
}

function formatCounts({
  skill,
  writes,
}: {
  skill: PlacementItemsSkill;
  writes: ReturnType<typeof getWrites>;
}): string {
  return [
    writes.quick ? `\n   QUICK_COUNT: ${skill.quickCount}` : "",
    writes.taps ? `\n   TAP_COUNT: ${skill.tapCount}` : "",
  ].join("");
}

function formatSkills(skills: readonly PlacementItemsSkill[]): string {
  const writes = getWrites(skills);

  return skills
    .map(
      (skill, index) =>
        `${index + 1}. SKILL: ${skill.name}\n   SKILL_DESCRIPTION: ${skill.description}\n   LEVEL: ${skill.level}${formatCounts({ skill, writes })}${formatUsedSituations({ indent: "   ", situations: skill.usedSituations })}`,
    )
    .join("\n");
}

function buildSystemPrompt(params: PlacementItemsParams): string {
  const writes = getWrites(params.skills);

  const formats: ItemFormat[] = [
    ...(writes.quick ? [params.quickFormat] : []),
    ...(writes.taps ? (["matchPairs", "order"] as const) : []),
  ];

  const prompt = selectPromptVariants({
    template: taskPrompt,
    variants: { ...writes, trueFalse: writes.quick && params.quickFormat === "trueFalse" },
  });

  return withItemRules(prompt, {
    field: false,
    formats,
    languageGoal: Boolean(params.targetLanguage),
    usedSituations: params.skills.some((skill) => skill.usedSituations?.length),
  });
}

function buildUserPrompt(params: PlacementItemsParams): string {
  const { country, examFormat, language, quickFormat, skills, targetLanguage } = params;
  const writes = getWrites(skills);

  const quickLines = writes.quick
    ? `\n    QUICK_FORMAT: ${quickFormat}${
        quickFormat === "multipleChoice"
          ? `\n    OPTION_COUNT: ${examFormat?.optionCount ?? DEFAULT_OPTION_COUNT}`
          : ""
      }`
    : "";

  return `${quickLines}
    LANGUAGE: ${getPromptLanguageName({ language })}
${formatItemSetting({ country, language, seed: getSituationSeed(skills), targetLanguage })}
    EXAM: ${examFormat?.name ?? "none"}
    EXAM_STYLE: ${examFormat?.style ?? "none"}
    SKILLS:
${formatSkills(skills)}
  `;
}

/* oxlint-disable eslint/sort-keys -- Structured output follows schema property order: the model names the skill before writing about it. */
function buildSchema({ quickFormat, skills }: PlacementItemsParams) {
  const writes = getWrites(skills);
  const skill = z.number().int();
  const quick = z.array(GENERATED_ITEM_SCHEMAS[quickFormat]);
  const taps = z.array(tapSchema);

  if (!writes.taps) {
    return z.object({ skills: z.array(z.object({ skill, quick })) });
  }

  return z.object({
    skills: z.array(writes.quick ? z.object({ skill, quick, taps }) : z.object({ skill, taps })),
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
    reasoning = defaultReasoning,
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

  // A list no skill asks for isn't in the answer.
  const written = new Map<number, WrittenSkill>(
    result.output.skills.map((entry) => [entry.skill, entry]),
  );

  const items: PlacementSkillItems[] = skills.map((_, index) => ({
    quick: written.get(index + 1)?.quick ?? [],
    taps: (written.get(index + 1)?.taps ?? []).map((tap) => toTapItem(tap)),
  }));

  return { data: { skills: items }, provenance, systemPrompt, usage: result.usage, userPrompt };
}
