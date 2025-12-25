import { type SafeReturn, safeAsync } from "@zoonk/utils/error";
import sharp from "sharp";

export type OptimizeImageParams = {
  image: Buffer;
  format?: "webp" | "jpeg" | "png";
  quality?: number;
};

export async function optimizeImage({
  image,
  format = "webp",
  quality = 80,
}: OptimizeImageParams): Promise<SafeReturn<Buffer>> {
  const { data, error } = await safeAsync(() => {
    const pipeline = sharp(image);

    switch (format) {
      case "webp":
        return pipeline.webp({ quality }).toBuffer();
      case "jpeg":
        return pipeline.jpeg({ quality }).toBuffer();
      case "png":
        return pipeline.png({ quality }).toBuffer();
      default: {
        return pipeline.webp({ quality }).toBuffer();
      }
    }
  });

  if (error) {
    console.error("Error optimizing image:", error);
    return { data: null, error };
  }

  return { data, error: null };
}
