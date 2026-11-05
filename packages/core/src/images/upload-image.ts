import { put } from "@vercel/blob";
import { type SafeReturn, safeAsync } from "@zoonk/utils/error";
import { logError } from "@zoonk/utils/logger";
import { getPrivateBlobStore } from "@zoonk/utils/private-blob-store";

export async function uploadImage({
  abortSignal,
  access = "public",
  addRandomSuffix = true,
  fileName,
  image,
}: {
  abortSignal?: AbortSignal;
  access?: "private" | "public";
  addRandomSuffix?: boolean;
  fileName: string;
  image: Buffer;
}): Promise<SafeReturn<string>> {
  const { data: blob, error } = await safeAsync(() =>
    put(fileName, image, {
      abortSignal,
      access,
      addRandomSuffix,
      ...(access === "private" ? getPrivateBlobStore() : {}),
    }),
  );

  if (error) {
    logError("Error uploading image:", error);
    return { data: null, error };
  }

  return { data: blob.url, error: null };
}
