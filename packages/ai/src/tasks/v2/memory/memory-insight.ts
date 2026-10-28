import "server-only";
import { Output, generateText } from "ai";
import { formatUntrustedInput } from "../../../evaluate/untrusted-input";
import { type AiGenerationContext } from "../../../provenance/ai-generation-event";
import { runTaskGeneration } from "../../../provenance/run-task-generation";
import { type Reasoning, buildProviderOptions } from "../../../provider-options";
import { getPromptLanguageName } from "../../_utils/prompt-language";
import { type MemoryFactText, formatMemoryFactList } from "./memory-facts";
import planChangePrompt from "./memory-insight-plan-change.prompt.md";
import { type MemoryInsightKindName, memoryInsightOutputSchema } from "./memory-insight-rules";
import systemPrompt from "./memory-insight.prompt.md";

/** One short call per active learner per day, so the cheapest capable model. */
const defaultModel = "openai/gpt-6-luna";
const fallbackModels = ["google/gemini-3.8-flash"] as const;

/** The skills a gap's lessons teach that the coach reads; more would only crowd the input. */
const MAX_COVERED_SKILLS = 5;

export type MemoryInsightSkill = {
  name: string;
  prepares: string;
  lessons: number;
  /** Null unless the gap takes a whole chapter. */
  chapter: string | null;
  covers: readonly string[];
};

export type MemoryInsightParams = {
  language: string;
  goal: string;
  /** Recent activity as code measured it; the model reads numbers, it doesn't compute them. */
  signals: string;
  facts: readonly MemoryFactText[];
  /** In the order a plan change's `skill` number refers to. */
  skills: readonly MemoryInsightSkill[];
  studyTime: string | null;
  recentInsights: readonly string[];
  kinds: readonly MemoryInsightKindName[];
  model?: string;
  useFallback?: boolean;
  reasoning?: Reasoning;
  analytics?: AiGenerationContext;
};

const planChangeSystemPrompt = `${systemPrompt}\n${planChangePrompt}`;

function allowsPlanChange(params: MemoryInsightParams): boolean {
  return params.kinds.includes("planChange");
}

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

function formatSkill(skill: MemoryInsightSkill): string {
  return `${skill.name}: ${formatSize(skill)} (teaches ${formatCovers(skill.covers)}). Prepares for ${skill.prepares}.`;
}

function buildUserPrompt(params: MemoryInsightParams): string {
  const skills: Record<string, string> = allowsPlanChange(params)
    ? { SKILLS: formatList(params.skills.map((skill) => formatSkill(skill))) }
    : {};

  return [
    `LANGUAGE: ${getPromptLanguageName({ language: params.language })}`,
    `KINDS: ${params.kinds.join(", ")}`,
    `STUDY_TIME: ${params.studyTime ?? "none"}`,
    `SIGNALS:\n${params.signals}`,
    formatUntrustedInput({
      FACTS: formatMemoryFactList(params.facts),
      GOAL: params.goal,
      RECENT_INSIGHTS: formatList(params.recentInsights),
      ...skills,
    }),
  ].join("\n\n");
}

/** `none` when nothing is strong and new enough; `toMemoryInsight` checks what it proposes. */
export async function generateMemoryInsight(params: MemoryInsightParams) {
  const { analytics, model = defaultModel, reasoning, useFallback = true } = params;
  const instructions = allowsPlanChange(params) ? planChangeSystemPrompt : systemPrompt;
  const userPrompt = buildUserPrompt(params);
  const providerOptions = buildProviderOptions({ fallbackModels, model, useFallback });

  const { provenance, result } = await runTaskGeneration({
    analytics,
    generate: () =>
      generateText({
        instructions,
        model,
        output: Output.object({ schema: memoryInsightOutputSchema }),
        prompt: userPrompt,
        providerOptions,
        reasoning,
      }),
    systemPrompt: instructions,
    task: "memory-insight",
  });

  return {
    data: result.output,
    provenance,
    systemPrompt: instructions,
    usage: result.usage,
    userPrompt,
  };
}
