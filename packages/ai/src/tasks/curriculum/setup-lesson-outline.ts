import "server-only";
import { Output, generateText } from "ai";
import { z } from "zod";
import { formatUntrustedInput } from "../../evaluate/untrusted-input";
import { type AiGenerationContext } from "../../provenance/ai-generation-event";
import { runTaskGeneration } from "../../provenance/run-task-generation";
import { type Reasoning, buildProviderOptions } from "../../provider-options";
import { getPromptLanguageName } from "../_utils/prompt-language";
import { getVerbForm } from "../_utils/verb-form";
import { LESSON_SIZE } from "../lesson-spec/lesson-spec-rules";
import systemPrompt from "./setup-lesson-outline.prompt.md";

/**
 * The learner waits after picking "I'll set it up": on 8 cases (8 Nov 2026), Luna met every rule
 * at $0.2469/1k in 4.45 s p50; Haiku 5.5 (9.36, $0.1858/1k) broke a length or can-do rule on four.
 */
const defaultModel = "openai/gpt-6-luna";
const fallbackModels = ["anthropic/claude-haiku-5.5"] as const;

const schema = z.object({
  canDo: z.string(),
  description: z.string(),
  estimatedMinutes: z.number(),
  skill: z.string(),
  title: z.string(),
});

type SetupLessonOutline = z.infer<typeof schema>;

export type SetupLessonOutlineParams = {
  language: string;
  tool: string;
  /** windows, macos, linux, chromebook, or phone for a phone and no computer. */
  system: string;
  model?: string;
  useFallback?: boolean;
  reasoning?: Reasoning;
  analytics?: AiGenerationContext;
};

function buildUserPrompt(params: SetupLessonOutlineParams): string {
  return `
    LANGUAGE: ${getPromptLanguageName({ language: params.language })}
    VERB_FORM: ${getVerbForm(params.language)}
    SYSTEM: ${params.system}

${formatUntrustedInput({ TOOL: params.tool })}
  `;
}

function normalizeOutline(raw: SetupLessonOutline): SetupLessonOutline {
  return {
    canDo: raw.canDo.trim(),
    description: raw.description.trim(),
    estimatedMinutes: Math.min(
      LESSON_SIZE.maxMinutes,
      Math.max(LESSON_SIZE.minMinutes, Math.round(raw.estimatedMinutes)),
    ),
    skill: raw.skill.trim(),
    title: raw.title.trim(),
  };
}

export async function generateSetupLessonOutline(params: SetupLessonOutlineParams) {
  const { analytics, model = defaultModel, reasoning, useFallback = true } = params;
  const userPrompt = buildUserPrompt(params);
  const providerOptions = buildProviderOptions({ fallbackModels, model, useFallback });

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
    task: "setup-lesson-outline",
  });

  const data = normalizeOutline(result.output);

  return { data, provenance, systemPrompt, usage: result.usage, userPrompt };
}
