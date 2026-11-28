import "server-only";
import { Output, generateText } from "ai";
import { z } from "zod";
import { formatUntrustedInput } from "../../evaluate/untrusted-input";
import { type AiGenerationContext } from "../../provenance/ai-generation-event";
import { runTaskGeneration } from "../../provenance/run-task-generation";
import { type Reasoning, type ServiceTier, buildProviderOptions } from "../../provider-options";
import { getPromptLanguageName } from "../_utils/prompt-language";
import systemPrompt from "./check-clip-ending.prompt.md";

/**
 * On 35 labeled clips (27 Nov 2026), Gemini 3.1 Flash Lite caught 31 of 33 additions over three
 * runs and called one misread clip added, at 1.6 s p95 and $0.13/1k. Gemini 3.5 Flash Lite caught
 * 5 of 11. Gemini 3.8 Flash and MiMo V2.6 Pro, the other provider, caught all with no false alarm
 * but took 8 s and 6.5 s p95, past what a learner tapping a new phrase should wait.
 */
const defaultModel = "google/gemini-3.1-flash-lite";
const fallbackModels = ["google/gemini-3.8-flash", "xiaomi/mimo-v2.6-pro"] as const;

/* oxlint-disable eslint/sort-keys -- Structured output follows schema property order: the model writes what it heard before choosing. */
const schema = z.object({ heard: z.string(), added: z.enum(["none", "speech", "sound"]) });
/* oxlint-enable eslint/sort-keys */

export type ClipEndingCheck = z.infer<typeof schema>;

type CheckClipEndingParams = {
  audio: Uint8Array;
  mediaType: string;
  language: string;
  text: string;
  analytics?: AiGenerationContext;
  abortSignal?: AbortSignal;
  model?: string;
  reasoning?: Reasoning;
  serviceTier?: ServiceTier;
  useFallback?: boolean;
};

/**
 * Hears whether a clip says anything before or after its text, as a voice does when it finishes a
 * phrase left open ("vivo in" read as "vivo in ca"). A misread word with nothing added passes.
 */
export async function checkClipEnding({
  abortSignal,
  analytics,
  audio,
  language,
  mediaType,
  model = defaultModel,
  reasoning,
  serviceTier,
  text,
  useFallback = true,
}: CheckClipEndingParams) {
  const userPrompt = `LANGUAGE: ${getPromptLanguageName({ language })}

${formatUntrustedInput({ TEXT: text })}`;

  const providerOptions = buildProviderOptions({ fallbackModels, model, serviceTier, useFallback });

  const { provenance, result } = await runTaskGeneration({
    analytics,
    generate: () =>
      generateText({
        abortSignal,
        instructions: systemPrompt,
        messages: [
          {
            content: [
              { text: userPrompt, type: "text" },
              { data: audio, mediaType, type: "file" },
            ],
            role: "user",
          },
        ],
        model,
        output: Output.object({ schema }),
        providerOptions,
        reasoning,
      }),
    systemPrompt,
    task: "check-clip-ending",
  });

  const data: ClipEndingCheck = { added: result.output.added, heard: result.output.heard.trim() };

  return { data, provenance, systemPrompt, usage: result.usage, userPrompt };
}
