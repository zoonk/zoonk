import "server-only";
import { Output, generateText } from "ai";
import { z } from "zod";
import { type AiGenerationContext } from "../../provenance/ai-generation-event";
import { runTaskGeneration } from "../../provenance/run-task-generation";
import { type Reasoning, buildProviderOptions, chooseServiceTier } from "../../provider-options";
import { toMaterialTranscript } from "./material-transcript";
import systemPrompt from "./transcribe-material.prompt.md";

/**
 * On the transcribe-material eval (15 pages, 3 runs each, 25 Nov 2026) Haiku 5.5 and Luna passed
 * every sign, relation and invention check; Haiku read dense cursive better, at about half the cost
 * per page ($0.58/1k against $1.17/1k) and 2.5 s p50. Gemini 3.8 Flash was as accurate but took
 * 12 s p50 at $13/1k, so it only backs up both; Flash Lite kept struck-out words and changed
 * decimals.
 */
const defaultModel = "anthropic/claude-haiku-5.5";
const fallbackModels = ["openai/gpt-6-luna", "google/gemini-3.8-flash"] as const;

const USER_PROMPT = "Write down this page.";

const schema = z.object({ text: z.string() });

export type MaterialTranscription = z.infer<typeof schema>;

export type TranscribeMaterialParams = {
  /**
   * One photo or one PDF page as an image; a string is base64. Claude refuses images over 5 MB, so
   * callers send it scaled down, about 2000 px on its long side, which also keeps the cost per page.
   */
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
    data: { text: toMaterialTranscript(result.output.text) },
    provenance,
    systemPrompt,
    usage: result.usage,
    userPrompt: USER_PROMPT,
  };
}
