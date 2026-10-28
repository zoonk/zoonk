import "server-only";
import { Output, generateText } from "ai";
import { z } from "zod";
import { formatUntrustedInput } from "../../../evaluate/untrusted-input";
import { type AiGenerationContext } from "../../../provenance/ai-generation-event";
import { runTaskGeneration } from "../../../provenance/run-task-generation";
import { type Reasoning, buildProviderOptions } from "../../../provider-options";
import { getPromptLanguageName } from "../../_utils/prompt-language";
import { LESSON_SIZE } from "../lesson-spec/lesson-spec-rules";
import systemPrompt from "./setup-lesson-outline.prompt.md";

/**
 * The learner waits after picking "I'll set it up": Luna met every rule on the setup-lesson-outline
 * eval at 4.0s p50 (27 Sep 2026).
 */
const defaultModel = "openai/gpt-6-luna";
const fallbackModels = ["google/gemini-3.8-flash", "anthropic/claude-haiku-5.5"] as const;

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
