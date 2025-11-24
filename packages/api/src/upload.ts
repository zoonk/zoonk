import { put } from "@vercel/blob";
import type { GeneratedImage } from "@zoonk/ai";
import { type SafeReturn, safeAsync } from "@zoonk/utils/error";

export type UploadImageParams = {
  fileName: string;
  image: GeneratedImage;
};

export async function uploadGeneratedImage({
  fileName,
  image,
}: UploadImageParams): Promise<SafeReturn<string>> {
  const { data: blob, error: blobError } = await safeAsync(() =>
    put(fileName, Buffer.from(image.uint8Array), {
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
