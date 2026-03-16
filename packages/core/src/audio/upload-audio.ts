import "server-only";
import { put } from "@vercel/blob";
import { type SafeReturn, safeAsync } from "@zoonk/utils/error";
import { logError } from "@zoonk/utils/logger";

export async function uploadAudio({
  fileName,
  audio,
  access = "public",
  addRandomSuffix = true,
}: {
  fileName: string;
  audio: Uint8Array;
  access?: "public";
  addRandomSuffix?: boolean;
}): Promise<SafeReturn<string>> {
  const buffer = Buffer.from(audio);

  const { data: blob, error } = await safeAsync(() =>
    put(fileName, buffer, { access, addRandomSuffix }),
  );

  if (error) {
    logError("Error uploading audio:", error);
    return { data: null, error };
  }

  return { data: blob.url, error: null };
}
