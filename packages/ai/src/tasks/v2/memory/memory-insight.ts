import "server-only";
import { Output, generateText } from "ai";
import { formatUntrustedInput } from "../../../evaluate/untrusted-input";
import { type AiGenerationContext } from "../../../provenance/ai-generation-event";
import { runTaskGeneration } from "../../../provenance/run-task-generation";
import { type Reasoning, buildProviderOptions } from "../../../provider-options";
import { getPromptLanguageName } from "../../_utils/prompt-language";
import { type MemoryFactText, formatMemoryFactList } from "./memory-facts";
import { type MemoryInsightKindName, memoryInsightOutputSchema } from "./memory-insight-rules";
import systemPrompt from "./memory-insight.prompt.md";

/** One short call per active learner per day, so the cheapest capable model. */
const defaultModel = "openai/gpt-6-luna";
const fallbackModels = ["google/gemini-3.8-flash"] as const;

/** The skills a gap's lessons teach that the coach reads; more would only crowd the input. */
const MAX_COVERED_SKILLS = 5;

/**
 * A missing prerequisite a plan change could add, with what adding it takes, as code sized it
 * from the learner's unlearned prerequisites: one short lesson, a few, or a whole chapter.
 */
export type MemoryInsightSkill = {
  /** The prerequisite the mistakes may point at, such as "Fractions as percentages". */
  name: string;
  /** The skill the learner struggles with that it prepares for, such as "Percentages". */
  prepares: string;
  /** How many short lessons the plan would add. */
  lessons: number;
  /** The chapter those lessons are, when the gap takes a whole chapter; null otherwise. */
  chapter: string | null;
  /** The skills the lessons teach, in teaching order. */
  covers: readonly string[];
};

export type MemoryInsightParams = {
  language: string;
  goal: string;
  /** Recent activity as code measured it; the model reads numbers, it doesn't compute them. */
  signals: string;
  facts: readonly MemoryFactText[];
  /** Gaps a plan change could fill, in the order a plan change's `skill` number refers to. */
  skills: readonly MemoryInsightSkill[];
  studyTime: string | null;
  /** Insights shown in the last days, so the coach doesn't repeat itself. */
  recentInsights: readonly string[];
  kinds: readonly MemoryInsightKindName[];
  model?: string;
  useFallback?: boolean;
  reasoning?: Reasoning;
  analytics?: AiGenerationContext;
};

function formatList(items: readonly string[]): string {
  return items.length === 0
    ? "none"
    : items.map((item, index) => `${index + 1}. ${item}`).join("\n");
}

function formatSize(skill: MemoryInsightSkill): string {
  if (skill.chapter) {
    return `a chapter, "${skill.chapter}", of ${skill.lessons} short lessons`;
  }

  return skill.lessons === 1 ? "1 short lesson" : `${skill.lessons} short lessons`;
}

function formatCovers(covers: readonly string[]): string {
  const shown = covers.slice(0, MAX_COVERED_SKILLS);
  const more = covers.length - shown.length;

  return more > 0 ? `${shown.join("; ")}; and ${more} more` : shown.join("; ");
}

/** One gap per line: "Fractions: 3 short lessons (teaches ...). Prepares for Percentages." */
function formatSkill(skill: MemoryInsightSkill): string {
  return `${skill.name}: ${formatSize(skill)} (teaches ${formatCovers(skill.covers)}). Prepares for ${skill.prepares}.`;
}

function buildUserPrompt(params: MemoryInsightParams): string {
  return [
    `LANGUAGE: ${getPromptLanguageName({ language: params.language })}`,
    `KINDS: ${params.kinds.join(", ")}`,
    `STUDY_TIME: ${params.studyTime ?? "none"}`,
    `SIGNALS:\n${params.signals}`,
    formatUntrustedInput({
      FACTS: formatMemoryFactList(params.facts),
      GOAL: params.goal,
      RECENT_INSIGHTS: formatList(params.recentInsights),
      SKILLS: formatList(params.skills.map((skill) => formatSkill(skill))),
    }),
  ].join("\n\n");
}

/**
 * Reads a learner's recent answers, mistakes, study times and memory, and proposes at most one
 * insight: a tip, what a gap needs added to the plan (a lesson, a few or a chapter, said at its
 * real size), or a better study time. It answers `none`
 * when nothing is strong and new enough; `toMemoryInsight` checks what it proposes.
 */
export async function generateMemoryInsight(params: MemoryInsightParams) {
  const { analytics, model = defaultModel, reasoning, useFallback = true } = params;
  const userPrompt = buildUserPrompt(params);
  const providerOptions = buildProviderOptions({ fallbackModels, model, useFallback });

  const { provenance, result } = await runTaskGeneration({
    analytics,
    generate: () =>
      generateText({
        instructions: systemPrompt,
        model,
        output: Output.object({ schema: memoryInsightOutputSchema }),
        prompt: userPrompt,
        providerOptions,
        reasoning,
      }),
    systemPrompt,
    task: "memory-insight",
  });

  return { data: result.output, provenance, systemPrompt, usage: result.usage, userPrompt };
}
