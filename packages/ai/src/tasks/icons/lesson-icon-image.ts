import "server-only";
import { type AiGenerationContext } from "../../provenance/ai-generation-event";
import { runImageTaskGeneration } from "../../provenance/run-image-generation";
import { type ImageGenerationQuality, buildImageProviderOptions } from "../../provider-options";
import { generateImageWithSafetyRetry } from "../_utils/generate-image-with-safety-retry";
import { type IconNeed } from "./icon-need";
import stylePrompt from "./lesson-icon-style.prompt.md";

/**
 * The model lesson pictures use: it drew as well as GPT Image 2.6 on the feasibility study's eight
 * subjects, at about a quarter of the price ($0.0068 an icon at low quality, 5 Nov 2026).
 */
const defaultModel = "openai/gpt-image-2.5-flare";
const DEFAULT_QUALITY: ImageGenerationQuality = "low";
const ICON_SIZE = "1024x1024";

/** Bump it when the style changes, so icons drawn before can be found and redrawn. */
export const LESSON_ICON_STYLE_VERSION = 1;

function buildIconPrompt({ input }: { input: string }): string {
  return stylePrompt.replace("{{SUBJECT}}", () => input);
}

export type LessonIconImageParams = {
  need: Pick<IconNeed, "description" | "name">;
  analytics?: AiGenerationContext;
  model?: string;
  quality?: ImageGenerationQuality;
  /** Evals turn fallbacks off so each icon comes from the model under test. */
  useFallback?: boolean;
};

/** A transparent square drawing; code checks the file and makes the app's sizes. */
export async function generateLessonIconImage({
  analytics,
  model = defaultModel,
  need,
  quality = DEFAULT_QUALITY,
  useFallback = true,
}: LessonIconImageParams) {
  const input = `${need.name}: ${need.description}`;

  const { provenance, result } = await runImageTaskGeneration({
    analytics,
    generate: ({ promptTraining }) =>
      generateImageWithSafetyRetry({
        analytics,
        buildPrompt: buildIconPrompt,
        input,
        maxImagesPerCall: 1,
        model,
        providerOptions: buildImageProviderOptions({
          background: "transparent",
          promptTraining,
          quality,
          size: ICON_SIZE,
          useFallback,
        }),
        size: ICON_SIZE,
      }),
    libraryInput: true,
    promptVersion: `icon-style-v${LESSON_ICON_STYLE_VERSION}`,
    requestedModel: model,
    systemPrompt: stylePrompt,
    task: "lesson-icon",
  });

  return { data: { image: result.image }, prompt: buildIconPrompt({ input }), provenance };
}
