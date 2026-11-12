import "server-only";
import { Output, generateText } from "ai";
import { z } from "zod";
import { formatUntrustedInput } from "../../evaluate/untrusted-input";
import { type AiGenerationContext } from "../../provenance/ai-generation-event";
import { runTaskGeneration } from "../../provenance/run-task-generation";
import { type Reasoning, buildProviderOptions } from "../../provider-options";
import { formatLocalContext, formatMoneyForms, getCountryName } from "../_utils/language-context";
import { getPromptLanguageName } from "../_utils/prompt-language";
import { selectPromptVariants } from "../_utils/prompt-variants";
import promptTemplate from "./example-lines.prompt.md";

/**
 * Luna scored 9.68 on the example-lines eval at 4.2s p50, ahead of Claude Haiku 5.5 (7 Oct 2026).
 * On 10 cases (11 Nov 2026), Luna scored 9.66 at $0.22/1k; Muse Ember scored 9.90 at $0.97/1k, too
 * little gain for four times the cost, and won a blind read 4 to 1 against Flash Lite (9.00), which
 * left lines empty where a fact fit.
 */
const defaultModel = "openai/gpt-6-luna";
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
  const { analytics, model = defaultModel, reasoning, useFallback = true } = params;
  const userPrompt = buildUserPrompt(params);

  const systemPrompt = selectPromptVariants({
    template: promptTemplate,
    variants: { plainWords: params.plainWords ?? false },
  });

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
    systemPrompt: promptTemplate,
    task: "example-lines",
  });

  const lines = toScreenLines({ lines: result.output.lines, screenCount: params.screens.length });

  return { data: { lines }, provenance, systemPrompt, usage: result.usage, userPrompt };
}
