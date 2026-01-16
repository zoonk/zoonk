export type { GeneratedFile } from "ai";

export type ReasoningEffort = "auto" | "low" | "medium" | "high";

type ProviderOptionsParams = {
  useFallback: boolean;
  fallbackModels: string[];
  reasoningEffort?: ReasoningEffort;
};

type ProviderOptionsResult = {
  gateway: { models: string[] };
  openai?: { reasoningEffort: ReasoningEffort };
};

export function buildProviderOptions({
  useFallback,
  fallbackModels,
  reasoningEffort,
}: ProviderOptionsParams): ProviderOptionsResult {
  const options: ProviderOptionsResult = {
    gateway: { models: useFallback ? fallbackModels : [] },
  };

  if (reasoningEffort && reasoningEffort !== "auto") {
    options.openai = { reasoningEffort };
  }

  return options;
}
