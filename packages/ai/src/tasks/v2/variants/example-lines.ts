import "server-only";
import { Output, generateText } from "ai";
import { z } from "zod";
import { formatUntrustedInput } from "../../../evaluate/untrusted-input";
import { type AiGenerationContext } from "../../../provenance/ai-generation-event";
import { runTaskGeneration } from "../../../provenance/run-task-generation";
import { type Reasoning, buildProviderOptions } from "../../../provider-options";
import { formatLocalContext } from "../../_utils/language-context";
import { getPromptLanguageName } from "../../_utils/prompt-language";
import systemPrompt from "./example-lines.prompt.md";

/**
 * Luna scored 9.68 on the example-lines eval at 4.2s p50, ahead of Claude Haiku 5.5 (7 Oct 2026).
 */
const defaultModel = "openai/gpt-6-luna";
const fallbackModels = ["google/gemini-3.5-flash-lite"] as const;

const schema = z.object({
  lines: z.array(z.object({ line: z.string().nullable(), screen: z.number().int() })),
});

type ExampleLineScreen = { text: string; idea: string };

export type GenerateExampleLinesParams = {
  language: string;
  /** In lesson order. */
  screens: readonly ExampleLineScreen[];
  /** Already limited to the categories this task may read. */
  facts: string[];
  goal: string | null;
  /** This lesson's first, then the learner's latest from other lessons. */
  earlierLines?: readonly string[];
  model?: string;
  useFallback?: boolean;
  reasoning?: Reasoning;
  analytics?: AiGenerationContext;
};

function formatScreens(screens: readonly ExampleLineScreen[]): string {
  return screens
    .map((screen, index) => `${index + 1}.\nTEXT: ${screen.text}\nIDEA: ${screen.idea}`)
    .join("\n\n");
}

function buildUserPrompt(params: GenerateExampleLinesParams): string {
  return `
    LANGUAGE: ${getPromptLanguageName({ language: params.language })}
${formatLocalContext(params.language)}

SCREENS:
${formatScreens(params.screens)}

${formatUntrustedInput({
  EARLIER_LINES: params.earlierLines?.map((line) => `- ${line}`).join("\n") || "none",
  FACTS: params.facts.map((fact) => `- ${fact}`).join("\n") || "none",
  GOAL: params.goal ?? "none",
})}
  `;
}

/** Matched by the number the model gave it; null for a screen it left out. */
function toScreenLines({
  lines,
  screenCount,
}: {
  lines: readonly { line: string | null; screen: number }[];
  screenCount: number;
}): (string | null)[] {
  return Array.from(
    { length: screenCount },
    (_, index) => lines.find((entry) => entry.screen === index + 1)?.line?.trim() || null,
  );
}

/** Callers store the nulls too, so the model isn't asked again for the same facts. */
export async function generateExampleLines(params: GenerateExampleLinesParams) {
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
    task: "example-lines",
  });

  const lines = toScreenLines({ lines: result.output.lines, screenCount: params.screens.length });

  return { data: { lines }, provenance, systemPrompt, usage: result.usage, userPrompt };
}
