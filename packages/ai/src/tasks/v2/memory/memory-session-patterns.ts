import "server-only";
import { Output, generateText } from "ai";
import { z } from "zod";
import { formatUntrustedInput } from "../../../evaluate/untrusted-input";
import { type AiGenerationContext } from "../../../provenance/ai-generation-event";
import { runTaskGeneration } from "../../../provenance/run-task-generation";
import { type Reasoning, buildProviderOptions } from "../../../provider-options";
import { getPromptLanguageName } from "../../_utils/prompt-language";
import systemPrompt from "./memory-session-patterns.prompt.md";

const defaultModel = "openai/gpt-6-luna";
const fallbackModels = ["google/gemini-3.8-flash"] as const;

const sessionPatternSchema = z.object({ evidence: z.string(), statement: z.string() });
const schema = z.object({ patterns: z.array(sessionPatternSchema) });

export type SessionPattern = z.infer<typeof sessionPatternSchema>;
export type SessionPatternsSchema = z.infer<typeof schema>;

export type SessionPatternsParams = {
  language: string;
  /** As code measured them. */
  activity: string;
  model?: string;
  useFallback?: boolean;
  reasoning?: Reasoning;
  analytics?: AiGenerationContext;
};

function buildUserPrompt({ activity, language }: SessionPatternsParams) {
  return [
    `LANGUAGE: ${getPromptLanguageName({ language })}`,
    formatUntrustedInput({ INPUT: activity }),
  ].join("\n");
}

/** Each pattern goes through the same gate and reconciliation as what the learner says. */
export async function findSessionPatterns({
  analytics,
  model = defaultModel,
  reasoning,
  useFallback = true,
  ...params
}: SessionPatternsParams) {
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
    systemPrompt,
    task: "memory-session-patterns",
  });

  return { data: result.output, provenance, systemPrompt, usage: result.usage, userPrompt };
}
