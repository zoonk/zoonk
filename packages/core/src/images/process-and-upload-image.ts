import "server-only";
import {
  DEFAULT_IMAGE_ACCEPTED_TYPES,
  DEFAULT_IMAGE_MAX_SIZE,
  DEFAULT_IMAGE_QUALITY,
} from "@zoonk/utils/constants";
import { safeAsync } from "@zoonk/utils/error";
import { optimizeImage } from "./optimize-image";
import { uploadImage } from "./upload-image";

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
  acceptedTypes = DEFAULT_IMAGE_ACCEPTED_TYPES,
  addRandomSuffix = true,
  format = "webp",
  maxSize = DEFAULT_IMAGE_MAX_SIZE,
  quality = DEFAULT_IMAGE_QUALITY,
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
