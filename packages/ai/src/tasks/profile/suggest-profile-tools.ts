import "server-only";
import { Output, generateText } from "ai";
import { z } from "zod";
import { formatUntrustedInput } from "../../evaluate/untrusted-input";
import { type AiGenerationContext } from "../../provenance/ai-generation-event";
import { runTaskGeneration } from "../../provenance/run-task-generation";
import { buildProviderOptions, chooseServiceTier } from "../../provider-options";
import { getCountryName } from "../_utils/language-context";
import { getPromptLanguageName } from "../_utils/prompt-language";
import systemPrompt from "./suggest-profile-tools.prompt.md";

const defaultModel = "openai/gpt-6-luna";
const fallbackModels = ["anthropic/claude-haiku-5.5"] as const;

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

  return { data: result.output, provenance, systemPrompt, usage: result.usage, userPrompt };
}
