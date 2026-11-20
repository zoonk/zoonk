import "server-only";
import { normalizeString, stripWrappingQuotes } from "@zoonk/utils/string";
import { toPlainLine } from "@zoonk/utils/text-repairs";
import { Output, generateText } from "ai";
import { z } from "zod";
import { formatUntrustedInput } from "../../evaluate/untrusted-input";
import { type AiGenerationContext } from "../../provenance/ai-generation-event";
import { runTaskGeneration } from "../../provenance/run-task-generation";
import { buildProviderOptions, chooseServiceTier } from "../../provider-options";
import { getCountryName } from "../_utils/language-context";
import { getPromptLanguageName } from "../_utils/prompt-language";
import systemPrompt from "./suggest-profile-tools.prompt.md";

/**
 * On 19 cases (20 Nov 2026), GPT-6 Luna scored 9.29 over 3 runs at $0.26/1k and Gemini 3.8 Flash
 * 9.32 at $2.83/1k; a blind read found them even, Luna better when little is known (Gemini leans to
 * office apps for a teenager) and Gemini better at country apps. GPT-6.1 Terra (9.36, 1 run) costs
 * 6x Luna for no visible gain. Haiku 5.5 (8.65) and Flash Lite (8.64) listed categories ("PDF"),
 * generic office apps for a Brazilian nurse or law intern, and duplicates.
 */
const defaultModel = "openai/gpt-6-luna";
const fallbackModels = ["google/gemini-3.8-flash"] as const;

const schema = z.object({ tools: z.array(z.string()) });

export type SuggestProfileToolsSchema = z.infer<typeof schema>;

export type SuggestProfileToolsInput = {
  language: string;
  country: string | null;
  goals: string[];
  workStatus: "work" | "student" | "workAndStudy" | "neither" | null;
  job: string | null;
  studies: string[];
};

export type SuggestProfileToolsParams = SuggestProfileToolsInput & {
  analytics?: AiGenerationContext;
  model?: string;
  useFallback?: boolean;
};

function formatList(values: string[]): string {
  return values.length > 0 ? values.map((value) => `- ${value}`).join("\n") : "none";
}

/** Chips show names as written, so a repeat in another case or with quotes would show twice. */
function cleanToolNames(tools: string[]): string[] {
  const names = tools.map((tool) => stripWrappingQuotes(toPlainLine(tool)).trim());
  const keys = names.map((name) => normalizeString(name));
  return names.filter((name, index) => name && keys.indexOf(keys[index] ?? "") === index);
}

function buildUserPrompt({
  country,
  goals,
  job,
  language,
  studies,
  workStatus,
}: SuggestProfileToolsInput): string {
  return [
    `APP_LANGUAGE: ${getPromptLanguageName({ language })}`,
    `COUNTRY: ${country ? getCountryName(country) : "unknown"}`,
    `WORK_STATUS: ${workStatus ?? "unknown"}`,
    formatUntrustedInput({
      GOALS: formatList(goals),
      JOB: job ?? "unknown",
      STUDIES: formatList(studies),
    }),
  ].join("\n\n");
}

export async function suggestProfileTools({
  analytics,
  model = defaultModel,
  useFallback = true,
  ...input
}: SuggestProfileToolsParams) {
  const userPrompt = buildUserPrompt(input);

  const providerOptions = buildProviderOptions({
    fallbackModels,
    model,
    serviceTier: chooseServiceTier({ wait: "soon" }),
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
      }),
    systemPrompt,
    task: "suggest-profile-tools",
  });

  return {
    data: { tools: cleanToolNames(result.output.tools) },
    provenance,
    systemPrompt,
    usage: result.usage,
    userPrompt,
  };
}
