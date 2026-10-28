import "server-only";
import { type AiGenerationContext } from "@zoonk/ai/ai-generation-event";
import { drawExamSpeakingPhoto } from "@zoonk/ai/tasks/v2/language/exam-speaking-photo";
import { optimizeImage } from "../../../images/optimize-image";
import { uploadImage } from "../../../images/upload-image";
import { type SpeakingCard } from "../speaking-contract";

const PHOTO_FILE_NAME = "library/speaking/photo.webp";

async function drawPhoto({
  alt,
  analytics,
  scene,
}: {
  alt: string;
  analytics: AiGenerationContext;
  scene: string;
}): Promise<SpeakingCard["photos"][number]> {
  const { data } = await drawExamSpeakingPhoto({ analytics, scene });
  const optimized = await optimizeImage({ image: Buffer.from(data.image.uint8Array) });

  if (optimized.error) {
    throw optimized.error;
  }

  const upload = await uploadImage({ fileName: PHOTO_FILE_NAME, image: optimized.data });

  if (upload.error) {
    throw upload.error;
  }

  return { alt, url: upload.data };
}

export function drawSpeakingPhotos({
  analytics,
  photos,
}: {
  analytics: AiGenerationContext;
  photos: readonly { alt: string; scene: string }[];
}): Promise<SpeakingCard["photos"]> {
  return Promise.all(photos.map((photo) => drawPhoto({ ...photo, analytics })));
}
