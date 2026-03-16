import "server-only";
import { put } from "@vercel/blob";
import { type SafeReturn, safeAsync } from "@zoonk/utils/error";
import { logError } from "@zoonk/utils/logger";

export async function uploadImage({
  fileName,
  image,
  access = "public",
  addRandomSuffix = true,
}: {
  fileName: string;
  image: Buffer;
  access?: "public";
  addRandomSuffix?: boolean;
}): Promise<SafeReturn<string>> {
  const { data: blob, error } = await safeAsync(() =>
    put(fileName, image, { access, addRandomSuffix }),
  );

  if (error) {
    logError("Error uploading image:", error);
    return { data: null, error };
  }

  return { data: blob.url, error: null };
}
