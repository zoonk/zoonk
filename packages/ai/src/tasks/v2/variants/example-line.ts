import "server-only";
import { Output, generateText } from "ai";
import { z } from "zod";
import { formatUntrustedInput } from "../../../evaluate/untrusted-input";
import { type AiGenerationContext } from "../../../provenance/ai-generation-event";
import { runTaskGeneration } from "../../../provenance/run-task-generation";
import { type Reasoning, buildProviderOptions } from "../../../provider-options";
import { formatLocalContext } from "../../_utils/language-context";
import { getPromptLanguageName } from "../../_utils/prompt-language";
import systemPrompt from "./example-line.prompt.md";

/**
 * One short sentence per learner and screen. In the example-line eval (4
 * learners in English and Portuguese, one where nothing fits, 26 Sep 2026)
 * Luna scored 9.51 at $0.11 per 1,000 and Gemini 3.5 Flash Lite 9.40 at $0.19.
 */
const defaultModel = "openai/gpt-6-luna";
const fallbackModels = ["google/gemini-3.5-flash-lite"] as const;

const schema = z.object({ line: z.string().nullable() });

export type GenerateExampleLineParams = {
  language: string;
  /** The explanation the learner is reading. */
  screenText: string;
  /** What the personal example should connect to, from the screen's example-line slot. */
  idea: string;
  /** Facts the learner shared, already limited to the categories this task may read. */
  facts: string[];
  /** The learner's goal, such as "Pass the ENEM for Medicine", or null. */
  goal: string | null;
  model?: string;
  useFallback?: boolean;
  reasoning?: Reasoning;
  analytics?: AiGenerationContext;
};

function buildUserPrompt(params: GenerateExampleLineParams): string {
  return `
    LANGUAGE: ${getPromptLanguageName({ language: params.language })}
${formatLocalContext(params.language)}
    SCREEN: ${params.screenText}
    IDEA: ${params.idea}

${formatUntrustedInput({
  FACTS: params.facts.map((fact) => `- ${fact}`).join("\n") || "none",
  GOAL: params.goal ?? "none",
})}
  `;
}

/**
 * Writes the example line: one sentence that ties an explanation to this
 * learner's life, using only what they shared. It returns null when nothing
 * fits, which callers cache too, so the model isn't asked again for the same
 * facts.
 */
export async function generateExampleLine(params: GenerateExampleLineParams) {
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
    systemPrompt,
    task: "example-line",
  });

  const line = result.output.line?.trim() || null;

  return { data: { line }, provenance, systemPrompt, usage: result.usage, userPrompt };
}
