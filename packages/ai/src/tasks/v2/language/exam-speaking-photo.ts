import "server-only";
import { type AiGenerationContext } from "../../../provenance/ai-generation-event";
import { runImageTaskGeneration } from "../../../provenance/run-image-generation";
import { type ImageGenerationQuality, buildImageProviderOptions } from "../../../provider-options";
import { generateImageWithSafetyRetry } from "../../_utils/generate-image-with-safety-retry";

/**
 * Lesson pictures' model (`lesson-image`) at low quality, about $0.008 a picture: a speaking
 * task's photo only needs a clear everyday scene to describe and speculate about.
 */
const defaultModel = "openai/gpt-image-2.5-flare";
const DEFAULT_QUALITY: ImageGenerationQuality = "low";

/** Landscape, like the photos printed on an exam's task sheet. */
const PHOTO_SIZE = "1536x1024";

/** Changes to the template below that the scene doesn't show. */
const PHOTO_PROMPT_VERSION = "exam-photo-v1";

const PHOTO_TEMPLATE =
  "A realistic documentary-style photograph with natural light and natural colors, of this everyday moment: {{SCENE}}. Real people with natural expressions, nobody famous. Nothing to read anywhere in the picture: no text, letters, numbers, signs, labels, logos or watermarks.";

export type DrawExamSpeakingPhotoParams = {
  /** The card writer's scene, in English. */
  scene: string;
  analytics?: AiGenerationContext;
  model?: string;
  quality?: ImageGenerationQuality;
  useFallback?: boolean;
};

function buildPrompt({ input }: { input: string }): string {
  return PHOTO_TEMPLATE.replace("{{SCENE}}", () => input.trim().replace(/\.+$/u, ""));
}

/**
 * Draws one photo of a speaking task's card from the scene its writer described. Storing it is
 * core's: the picture holds nothing about the learner.
 */
export async function drawExamSpeakingPhoto({
  analytics,
  model = defaultModel,
  quality = DEFAULT_QUALITY,
  scene,
  useFallback = true,
}: DrawExamSpeakingPhotoParams) {
  const { provenance, result } = await runImageTaskGeneration({
    analytics,
    generate: ({ promptTraining }) =>
      generateImageWithSafetyRetry({
        analytics,
        buildPrompt,
        input: scene,
        maxImagesPerCall: 1,
        model,
        providerOptions: buildImageProviderOptions({
          promptTraining,
          quality,
          size: PHOTO_SIZE,
          useFallback,
        }),
        size: PHOTO_SIZE,
      }),
    promptVersion: PHOTO_PROMPT_VERSION,
    requestedModel: model,
    systemPrompt: PHOTO_TEMPLATE,
    task: "exam-speaking-photo",
  });

  return { data: { image: result.image }, provenance };
}
