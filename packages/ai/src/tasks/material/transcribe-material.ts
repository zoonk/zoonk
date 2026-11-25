import "server-only";
import { Output, generateText } from "ai";
import { z } from "zod";
import { type AiGenerationContext } from "../../provenance/ai-generation-event";
import { runTaskGeneration } from "../../provenance/run-task-generation";
import { type Reasoning, buildProviderOptions, chooseServiceTier } from "../../provider-options";
import systemPrompt from "./transcribe-material.prompt.md";

/** The upload-visibility chain, which already reads learners' photos and PDF pages, until this task's eval picks one. */
const defaultModel = "openai/gpt-6-luna";
const fallbackModels = ["google/gemini-3.8-flash", "google/gemini-3.5-flash-lite"] as const;

const USER_PROMPT = "Write down this page.";

const schema = z.object({ text: z.string() });

export type MaterialTranscription = z.infer<typeof schema>;

export type TranscribeMaterialParams = {
  /** One photo or one PDF page as an image; a string is base64. */
  image: { data: Uint8Array | string; mediaType: string };
  analytics?: AiGenerationContext;
  model?: string;
  useFallback?: boolean;
  reasoning?: Reasoning;
};

/** A learner's own file: never `libraryInput`, so it reaches only providers that don't train on prompts. */
export async function transcribeMaterial({
  analytics,
  image,
  model = defaultModel,
  reasoning,
  useFallback = true,
}: TranscribeMaterialParams) {
  const providerOptions = buildProviderOptions({
    fallbackModels,
    model,
    serviceTier: chooseServiceTier({ wait: "learner" }),
    useFallback,
  });

  const { provenance, result } = await runTaskGeneration({
    analytics,
    generate: () =>
      generateText({
        instructions: systemPrompt,
        model,
        output: Output.object({ schema }),
        prompt: [
          {
            content: [
              { text: USER_PROMPT, type: "text" },
              { data: image.data, mediaType: image.mediaType, type: "file" },
            ],
            role: "user",
          },
        ],
        providerOptions,
        reasoning,
      }),
    systemPrompt,
    task: "transcribe-material",
  });

  return {
    data: { text: result.output.text.trim() },
    provenance,
    systemPrompt,
    usage: result.usage,
    userPrompt: USER_PROMPT,
  };
}
