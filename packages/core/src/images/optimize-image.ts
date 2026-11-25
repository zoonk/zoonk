import { type SafeReturn, safeAsync } from "@zoonk/utils/error";
import { logError } from "@zoonk/utils/logger";
import { DEFAULT_IMAGE_QUALITY } from "@zoonk/utils/upload";
import sharp from "sharp";

export async function optimizeImage({
  image,
  format = "webp",
  limitInputPixels,
  maxEdge,
  quality = DEFAULT_IMAGE_QUALITY,
}: {
  image: Uint8Array;
  format?: "webp" | "jpeg" | "png";
  limitInputPixels?: number;
  maxEdge?: number;
  quality?: number;
}): Promise<SafeReturn<Buffer>> {
  const { data, error } = await safeAsync(() => {
    const pipeline = sharp(image, { limitInputPixels });

    if (maxEdge !== undefined) {
      pipeline
        .autoOrient()
        .resize({ fit: "inside", height: maxEdge, width: maxEdge, withoutEnlargement: true });
    }

    switch (format) {
      case "webp":
        return pipeline.webp({ quality }).toBuffer();
      case "jpeg":
        return pipeline.flatten({ background: "white" }).jpeg({ quality }).toBuffer();
      case "png":
        return pipeline.png({ quality }).toBuffer();
      default:
        return pipeline.webp({ quality }).toBuffer();
    }
  });

  if (error) {
    logError("Error optimizing image:", error);
    return { data: null, error };
  }

  return { data, error: null };
}
