import { put } from "@vercel/blob";
import { type SafeReturn, safeAsync } from "@zoonk/utils/error";
import { logError } from "@zoonk/utils/logger";
import { getPrivateBlobStore } from "@zoonk/utils/private-blob-store";

/**
 * Uploads audio: shared clips to the public store, which the CDN serves to anyone, and a learner's
 * own words to the private store, which only they read through the file route.
 */
export async function uploadAudio({
  fileName,
  audio,
  access = "public",
  addRandomSuffix = true,
}: {
  fileName: string;
  audio: Uint8Array;
  access?: "private" | "public";
  addRandomSuffix?: boolean;
}): Promise<SafeReturn<string>> {
  const buffer = Buffer.from(audio);

  const { data: blob, error } = await safeAsync(() =>
    put(fileName, buffer, {
      access,
      addRandomSuffix,
      ...(access === "private" ? getPrivateBlobStore() : {}),
    }),
  );

  if (error) {
    logError("Error uploading audio:", error);
    return { data: null, error };
  }

  return { data: blob.url, error: null };
}
