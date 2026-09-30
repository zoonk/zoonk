import "server-only";
import { Output, generateText } from "ai";
import { type AiGenerationContext } from "../../../provenance/ai-generation-event";
import { runTaskGeneration } from "../../../provenance/run-task-generation";
import { type Reasoning, buildProviderOptions } from "../../../provider-options";
import { getPromptLanguageName } from "../../_utils/prompt-language";
import { type ImageScene, imageSceneSchema, normalizeImageScene } from "./image-scene-schema";
import systemPrompt from "./image-scene.prompt.md";

/**
 * From the image-scene eval (8 cases, code checks then Astra judge, 26 Sep
 * 2026): Gemini 3.8 Flash 9.72, Luna 9.40 and Flash Lite 9.13, at $2.97,
 * $0.31 and $0.55 per 1,000 scenes. The scene decides whether the picture
 * teaches, and even Flash adds little next to the image itself ($7 per 1,000).
 */
const defaultModel = "google/gemini-3.8-flash";
const fallbackModels = ["openai/gpt-6-luna", "google/gemini-3.5-flash-lite"] as const;

export type ImageSceneInput = {
  /** The lesson's language, for labels. */
  language: string;
  /** False for language courses: the image carries no text. */
  textAllowed: boolean;
  /** What the writer wants the picture to show. */
  request: string;
  /** The words shown next to the picture, when there are any. */
  screenText?: string | null;
  /** The lesson or chapter it belongs to, such as "Percentages › Discounts". */
  context?: string | null;
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
    SCREEN_TEXT: ${input.screenText || "none"}
    CONTEXT: ${input.context || "none"}
  `;
}

/**
 * Turns a writer's image request into a structured scene: one focal object,
 * up to two supporting objects, their relation, any motion and at most three
 * short labels in the lesson's language. Code then enforces those limits and
 * removes every label where text isn't allowed, so the style never depends on
 * the model obeying.
 */
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
    systemPrompt,
    task: "image-scene",
  });

  const data: ImageScene = normalizeImageScene({
    scene: result.output,
    textAllowed: input.textAllowed,
  });

  return { data, provenance, systemPrompt, usage: result.usage, userPrompt };
}
