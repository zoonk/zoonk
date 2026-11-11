import "server-only";
import { Output, generateText } from "ai";
import { type AiGenerationContext } from "../../provenance/ai-generation-event";
import { runTaskGeneration } from "../../provenance/run-task-generation";
import { type Reasoning, buildProviderOptions } from "../../provider-options";
import { getPromptLanguageName } from "../_utils/prompt-language";
import { type ImageScene, imageSceneSchema, normalizeImageScene } from "./image-scene-schema";
import systemPrompt from "./image-scene.prompt.md";

/**
 * On 18 cases (11 Nov 2026), Ember scored 9.62 at $1.17/1k against Flash's 9.60 at $3.34/1k.
 * Claude's blind reads split 6 wins each and 6 ties; both kept the scene's teaching quality.
 */
const defaultModel = "meta/muse-ember";
const fallbackModels = ["google/gemini-3.8-flash", "openai/gpt-6-luna"] as const;

export type ImageSceneInput = {
  language: string;
  /** False for language courses. */
  textAllowed: boolean;
  request: string;
  alt?: string | null;
  screenText?: string | null;
  context?: string | null;
  /** What the picture check found wrong in the last picture drawn for this request. */
  findings?: readonly string[] | null;
};

export type ImageSceneParams = ImageSceneInput & {
  analytics?: AiGenerationContext;
  model?: string;
  reasoning?: Reasoning;
  useFallback?: boolean;
};

function buildUserPrompt(input: ImageSceneInput): string {
  return `
    LANGUAGE: ${getPromptLanguageName({ language: input.language })}
    TEXT_ALLOWED: ${input.textAllowed ? "yes" : "no"}
    REQUEST: ${input.request}
    ALT: ${input.alt || "none"}
    SCREEN_TEXT: ${input.screenText || "none"}
    CONTEXT: ${input.context || "none"}
    FINDINGS: ${input.findings?.length ? input.findings.join("; ") : "none"}
  `;
}

/** Code enforces the scene's limits, so the style never depends on the model obeying. */
export async function generateImageScene({
  analytics,
  model = defaultModel,
  reasoning,
  useFallback = true,
  ...input
}: ImageSceneParams) {
  const userPrompt = buildUserPrompt(input);
  const providerOptions = buildProviderOptions({ fallbackModels, model, useFallback });

  const { provenance, result } = await runTaskGeneration({
    analytics,
    generate: () =>
      generateText({
        instructions: systemPrompt,
        model,
        output: Output.object({ schema: imageSceneSchema }),
        prompt: userPrompt,
        providerOptions,
        reasoning,
      }),
    libraryInput: true,
    systemPrompt,
    task: "image-scene",
  });

  const data: ImageScene = normalizeImageScene({
    scene: result.output,
    textAllowed: input.textAllowed,
  });

  return { data, provenance, systemPrompt, usage: result.usage, userPrompt };
}
