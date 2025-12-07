import { put } from "@vercel/blob";
import type { GeneratedImage } from "@zoonk/ai";
import { type SafeReturn, safeAsync } from "@zoonk/utils/error";
import sharp from "sharp";

export type UploadImageParams = {
  fileName: string;
  image: GeneratedImage;
};

const FILE_EXTENSION_REGEX = /\.\w+$/;

export async function uploadGeneratedImage({
  fileName,
  image,
}: UploadImageParams): Promise<SafeReturn<string>> {
  const { data: compressedImage, error: compressionError } = await safeAsync(
    () => sharp(Buffer.from(image.uint8Array)).webp({ quality: 80 }).toBuffer(),
  );

  if (compressionError) {
    console.error("Error compressing image:", compressionError);
    return { data: null, error: compressionError };
  }

  const webpFileName = fileName.replace(FILE_EXTENSION_REGEX, ".webp");

  const { data: blob, error: blobError } = await safeAsync(() =>
    put(webpFileName, compressedImage, {
      access: "public",
      addRandomSuffix: true,
    }),
  );

  if (blobError) {
    console.error("Error uploading generated image:", blobError);
    return { data: null, error: blobError };
  }

  return { data: blob.url, error: null };
}
