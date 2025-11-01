import { openai } from "@ai-sdk/openai";
import { put } from "@vercel/blob";
import {
  experimental_generateImage as generateImage,
  type ImageModel,
} from "ai";
import slugify from "slugify";

const DEFAULT_MODEL = openai.image("gpt-image-1-mini");
const DEFAULT_QUALITY = "low";

export function getCourseThumbnailPrompt(title: string) {
  return `
  Generate an icon to visually symbolize a topic using a simple, recognizable object.
  Style: 3D rendered with vivid high-contrast colors, smooth matte surfaces,
  clean sharp edges with slight bevels, realistic lighting and subtle shadows,
  minimalist and modern design, subtle neutral background, no text, square format (1:1).

  TOPIC: **${title}**
  `;
}

export type CourseThumbnailParams = {
  title: string;
  model?: ImageModel;
  quality?: "auto" | "low" | "medium" | "high";
};

export async function generateCourseThumbnail({
  title,
  model = DEFAULT_MODEL,
  quality = DEFAULT_QUALITY,
}: CourseThumbnailParams): Promise<string> {
  const { image } = await generateImage({
    maxImagesPerCall: 1,
    model,
    prompt: getCourseThumbnailPrompt(title),
    providerOptions: {
      openai: { output_format: "webp", quality },
    },
    size: "1024x1024",
  });

  const slug = slugify(title, { lower: true, strict: true });
  const fileName = `courses/${slug}.webp`;

  const blob = await put(fileName, Buffer.from(image.uint8Array), {
    access: "public",
    addRandomSuffix: true,
  });

  return blob.url;
}
