import "server-only";

import { safeAsync } from "@zoonk/utils/error";
import { optimizeImage } from "./optimize-image";
import { uploadImage } from "./upload-image";

const BYTES_PER_MB = 1024 * 1024;
const DEFAULT_MAX_SIZE = 5 * BYTES_PER_MB;

const DEFAULT_ACCEPTED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];

export type ProcessAndUploadImageParams = {
  file: File;
  fileName: string;
  acceptedTypes?: string[];
  addRandomSuffix?: boolean;
  format?: "webp" | "jpeg" | "png";
  maxSize?: number;
  quality?: number;
};

export type ProcessAndUploadImageError =
  | "invalidType"
  | "tooLarge"
  | "optimizeFailed"
  | "uploadFailed";

export type ProcessAndUploadImageResult =
  | { data: string; error: null }
  | { data: null; error: ProcessAndUploadImageError };

export async function processAndUploadImage({
  file,
  fileName,
  acceptedTypes = DEFAULT_ACCEPTED_TYPES,
  addRandomSuffix = true,
  format = "webp",
  maxSize = DEFAULT_MAX_SIZE,
  quality = 80,
}: ProcessAndUploadImageParams): Promise<ProcessAndUploadImageResult> {
  if (!acceptedTypes.includes(file.type)) {
    return { data: null, error: "invalidType" };
  }

  if (file.size > maxSize) {
    return { data: null, error: "tooLarge" };
  }

  const { data: buffer, error: bufferError } = await safeAsync(() =>
    file.arrayBuffer().then((ab) => Buffer.from(ab)),
  );

  if (bufferError) {
    return { data: null, error: "optimizeFailed" };
  }

  const { data: optimizedImage, error: optimizeError } = await optimizeImage({
    format,
    image: buffer,
    quality,
  });

  if (optimizeError) {
    return { data: null, error: "optimizeFailed" };
  }

  const { data: imageUrl, error: uploadError } = await uploadImage({
    addRandomSuffix,
    fileName,
    image: optimizedImage,
  });

  if (uploadError) {
    return { data: null, error: "uploadFailed" };
  }

  return { data: imageUrl, error: null };
}
