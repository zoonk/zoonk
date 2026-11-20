import "server-only";
import { Output, generateText } from "ai";
import { z } from "zod";
import { formatUntrustedInput } from "../../evaluate/untrusted-input";
import { type AiGenerationContext } from "../../provenance/ai-generation-event";
import { runTaskGeneration } from "../../provenance/run-task-generation";
import {
  type CallWait,
  type Reasoning,
  buildProviderOptions,
  chooseServiceTier,
} from "../../provider-options";
import { formatLocalContext, formatMoneyForms, getCountryName } from "../_utils/language-context";
import { getPromptLanguageName } from "../_utils/prompt-language";
import { selectPromptVariants } from "../_utils/prompt-variants";
import promptTemplate from "./example-lines.prompt.md";

/**
 * On 29 cases (20 Nov 2026, same prompt, 3 runs each; 2 for Flash Lite and Haiku), Terra scored
 * 9.46, Muse Ember 9.07, Luna 8.94, Flash Lite 8.02 and Haiku 5.5 7.86. For a developer taking a
 * coding lesson, Luna and Muse Ember wrote nothing in 4 of 6 runs where a hobby fit, and Terra in
 * none; Terra also left the fewest fitting lines empty (4 of 51, Luna 7). A blind read came out 6
 * to 7 against Luna (6 to 5 against Muse Ember on the prompt before), with Terra winning the coding
 * cases. At priority tier Terra scored 9.54 with a 4.9s p95 at $3.23/1k; without it, a few calls
 * queued for 30 to 80 seconds.
 */
const defaultModel = "openai/gpt-6.1-terra";
const fallbackModels = ["meta/muse-ember", "google/gemini-3.5-flash-lite"] as const;

const schema = z.object({
  lines: z.array(z.object({ line: z.string().nullable(), screen: z.number().int() })),
});

type ExampleLineScreen = { text: string; idea: string };

export type GenerateExampleLinesParams = {
  language: string;
  /** The country the lesson is set in; null is the language's own. */
  country: string | null;
  /** Where the learner said they live, only as they told us. */
  learnerHomeCountry: string | null;
  plainWords?: boolean;
  /** In lesson order. */
  screens: readonly ExampleLineScreen[];
  /** Already limited to the categories this task may read. */
  facts: string[];
  goal: string | null;
  /** This lesson's first, then the learner's latest from other lessons. */
  earlierLines?: readonly string[];
  /** "learner" when they're in the lesson now, "later" when written ahead in the background. */
  wait: CallWait;
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

function formatHomeCountry({ language, learnerHomeCountry }: GenerateExampleLinesParams): string {
  if (!learnerHomeCountry) {
    return "none";
  }

  const money = formatMoneyForms({ country: learnerHomeCountry, language });
  const name = getCountryName(learnerHomeCountry);
  return money ? `${name}, money written ${money}` : name;
}

function buildUserPrompt(params: GenerateExampleLinesParams): string {
  return `
    LANGUAGE: ${getPromptLanguageName({ language: params.language })}
${formatLocalContext({ country: params.country, language: params.language })}
    HOME_COUNTRY: ${formatHomeCountry(params)}

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
  const { analytics, model = defaultModel, reasoning, useFallback = true, wait } = params;
  const userPrompt = buildUserPrompt(params);

  const systemPrompt = selectPromptVariants({
    template: promptTemplate,
    variants: { plainWords: params.plainWords ?? false },
  });

  const providerOptions = buildProviderOptions({
    fallbackModels,
    model,
    serviceTier: chooseServiceTier({ wait }),
    useFallback,
  });

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
    systemPrompt: promptTemplate,
    task: "example-lines",
  });

  const lines = toScreenLines({ lines: result.output.lines, screenCount: params.screens.length });

  return { data: { lines }, provenance, systemPrompt, usage: result.usage, userPrompt };
}
