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
 * A few short sentences per learner and lesson. Writing one line per screen (26 Sep 2026), Luna
 * scored 9.51 at $0.11 per 1,000 and Gemini 3.5 Flash Lite 9.40 at $0.19. In the example-lines
 * eval (18 lessons of one to three screens in English and Portuguese, 7 Oct 2026) Luna scored 9.68
 * at $0.29 per 1,000 lessons, 4.2 s at the median. On 6 of them (7 Oct 2026) Claude Haiku 5.5
 * with thinking off scored 9.18 against Luna's 9.68, at $0.25 per 1,000 against $0.21.
 */
const defaultModel = "openai/gpt-6-luna";
const fallbackModels = ["google/gemini-3.5-flash-lite"] as const;

const schema = z.object({
  lines: z.array(z.object({ line: z.string().nullable(), screen: z.number().int() })),
});

/** One explanation that leaves room for a personal example. */
type ExampleLineScreen = {
  /** The explanation the learner reads. */
  text: string;
  /** What the personal example should connect to, from the screen's example-line slot. */
  idea: string;
};

export type GenerateExampleLinesParams = {
  language: string;
  /** The lesson's explanations that need a line, in lesson order. */
  screens: readonly ExampleLineScreen[];
  /** Facts the learner shared, already limited to the categories this task may read. */
  facts: string[];
  /** The learner's goal, such as "Pass the ENEM for Medicine", or null. */
  goal: string | null;
  /** Lines the learner already read, this lesson's first, then their latest from other lessons. */
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

/**
 * Each screen's line in screen order, matched by the number the model gave it: null for a screen
 * it left out or wrote nothing for, and nothing taken from a number that isn't a screen.
 */
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

/**
 * Writes the personal example lines of one lesson for one learner, all at once so each screen gets
 * its own moment: a sentence that ties the screen's idea to their life, using only what they
 * shared, or null where nothing fits or a line would repeat another. Callers store the nulls too,
 * so the model isn't asked again for the same facts.
 */
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
