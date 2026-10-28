import "server-only";
import { type AiGenerationContext } from "../../../provenance/ai-generation-event";
import { runImageTaskGeneration } from "../../../provenance/run-image-generation";
import { type TaskProvenance } from "../../../provenance/task-provenance";
import { type ImageGenerationQuality, buildImageProviderOptions } from "../../../provider-options";
import { generateImageWithSafetyRetry } from "../../_utils/generate-image-with-safety-retry";
import {
  MIND_MAP_IMAGE_TEMPLATE,
  MIND_MAP_STYLE_VERSION,
  buildMindMapImagePrompt,
  formatMindMapImageContent,
} from "./mind-map-image-prompt";
import { type MindMapStructure } from "./mind-map-schema";

/**
 * Flare at low quality lettered every word right on 9 of 9 maps for about $0.01 (7 Oct 2026);
 * medium cost more for the same, and Sunburst, the first fallback, matched it but took longer.
 */
const defaultModel = "openai/gpt-image-2.5-flare";
const DEFAULT_QUALITY: ImageGenerationQuality = "low";

/** Square, the size main draws icons at: the small print reads when the learner zooms in. */
const IMAGE_SIZE = "1024x1024";

export type MindMapImageParams = {
  structure: MindMapStructure;
  language: string;
  corrections?: readonly string[];
  analytics?: AiGenerationContext;
  model?: string;
  quality?: ImageGenerationQuality;
  /** Evals turn fallbacks off so each picture comes from the model under test. */
  useFallback?: boolean;
};

export async function generateMindMapImage({
  analytics,
  corrections,
  language,
  model = defaultModel,
  quality = DEFAULT_QUALITY,
  structure,
  useFallback = true,
}: MindMapImageParams): Promise<{
  data: { image: Uint8Array; mediaType: string };
  prompt: string;
  provenance: TaskProvenance;
}> {
  const content = formatMindMapImageContent({ corrections, language, structure });

  const { provenance, result } = await runImageTaskGeneration({
    analytics,
    generate: ({ promptTraining }) =>
      generateImageWithSafetyRetry({
        analytics,
        buildPrompt: ({ input }) => buildMindMapImagePrompt(input),
        input: content,
        maxImagesPerCall: 1,
        model,
        providerOptions: buildImageProviderOptions({
          promptTraining,
          quality,
          size: IMAGE_SIZE,
          useFallback,
        }),
        size: IMAGE_SIZE,
      }),
    libraryInput: true,
    promptVersion: `mind-map-style-v${MIND_MAP_STYLE_VERSION}`,
    requestedModel: model,
    systemPrompt: MIND_MAP_IMAGE_TEMPLATE,
    task: "mind-map-image",
  });

  return {
    data: { image: result.image.uint8Array, mediaType: result.image.mediaType },
    prompt: buildMindMapImagePrompt(content),
    provenance,
  };
}
