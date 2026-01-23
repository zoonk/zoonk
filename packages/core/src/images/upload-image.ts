import "server-only";
import { put } from "@vercel/blob";
import { type SafeReturn, safeAsync } from "@zoonk/utils/error";

export type UploadImageParams = {
  fileName: string;
  image: Buffer;
  access?: "public";
  addRandomSuffix?: boolean;
};

export async function uploadImage({
  fileName,
  image,
  access = "public",
  addRandomSuffix = true,
}: UploadImageParams): Promise<SafeReturn<string>> {
  const { data: blob, error } = await safeAsync(() =>
    put(fileName, image, { access, addRandomSuffix }),
  );

  if (error) {
    console.error("Error uploading image:", error);
    return { data: null, error };
  }

  return { data: blob.url, error: null };
}
