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
 * Main's image settings for lesson pictures and icons: GPT Image 2.5 Flare at low quality, square,
 * as webp. On the eval's four maps (three in Portuguese, 7 Oct 2026) it lettered every word right
 * on 9 of 9 pictures, in 11 to 14 seconds for about $0.01 a map. Medium cost $0.017 for the same
 * result; Sunburst matched it at the same price but took 17 to 19 seconds; Nano Banana 2.1 cost
 * $0.05 at 2K and wrote a word on a sketch, and dropped a branch at 1K. Sunburst is the fallback:
 * it letters Portuguese as well at the same price, and it serves calls that disallow prompt
 * training, which BFL's and Recraft's models don't.
 */
const defaultModel = "openai/gpt-image-2.5-flare";
const DEFAULT_QUALITY: ImageGenerationQuality = "low";
const fallbackModels = ["openai/gpt-image-2.5-sunburst"] as const;

/** Square, the size main draws icons at: the small print reads when the learner zooms in. */
const IMAGE_SIZE = "1024x1024";

export type MindMapImageParams = {
  structure: MindMapStructure;
  /** The map's language, for its fixed headings. */
  language: string;
  /** What the text check found wrong in the last picture of this map, for a second attempt. */
  corrections?: readonly string[];
  analytics?: AiGenerationContext;
  model?: string;
  quality?: ImageGenerationQuality;
  /** Evals turn fallbacks off so each picture comes from the model under test. */
  useFallback?: boolean;
};

/**
 * Draws a chapter's mind map from its structure in the fixed mind-map style, every text lettered
 * as written. Checking the text, storing and redrawing happen in core.
 */
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
    generate: () =>
      generateImageWithSafetyRetry({
        analytics,
        buildPrompt: ({ input }) => buildMindMapImagePrompt(input),
        input: content,
        maxImagesPerCall: 1,
        model,
        providerOptions: buildImageProviderOptions({
          fallbackModels: useFallback ? fallbackModels : [],
          quality,
        }),
        size: IMAGE_SIZE,
      }),
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
