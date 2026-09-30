import { put } from "@vercel/blob";
import { type SafeReturn, safeAsync } from "@zoonk/utils/error";
import { logError } from "@zoonk/utils/logger";
import { getPrivateBlobStore } from "@zoonk/utils/private-blob-store";

/**
 * Uploads an image: shared pictures to the public store, which the CDN serves to anyone, and a
 * private course's pictures to the private store, which only its owner reads through the file route.
 */
export async function uploadImage({
  access = "public",
  addRandomSuffix = true,
  fileName,
  image,
}: {
  access?: "private" | "public";
  addRandomSuffix?: boolean;
  fileName: string;
  image: Buffer;
}): Promise<SafeReturn<string>> {
  const { data: blob, error } = await safeAsync(() =>
    put(fileName, image, {
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
