import "server-only";
import { type ServiceTier } from "@zoonk/ai/provider-options";
import { checkLessonImage } from "@zoonk/ai/tasks/v2/images/check";
import { type LessonImageParams, generateLessonImage } from "@zoonk/ai/tasks/v2/images/generate";
import { type ImageScene } from "@zoonk/ai/tasks/v2/images/scene-schema";
import { logInfo } from "@zoonk/utils/logger";
import { isNearSolidImage } from "../../../images/image-quality";
import { type LibraryProvenance } from "../../_utils/library-rows";

const DEFAULT_ATTEMPTS = 2;

type ImageAnalytics = LessonImageParams["analytics"];

export type DrawImageInput = Omit<LessonImageParams, "model" | "quality"> & { attempts?: number };

export type DrawnImage = { image: Uint8Array; provenance: LibraryProvenance };

type ImageReview = { usable: boolean; problems: string[] };

const BLANK_FRAME = "the image was a blank frame";

async function isBlank(image: Uint8Array): Promise<boolean> {
  const { data: blank, error } = await isNearSolidImage({ image: Buffer.from(image) });

  if (error) {
    throw error;
  }

  return blank;
}

export async function reviewImage({
  analytics,
  image,
  language,
  scene,
  serviceTier,
}: {
  analytics?: ImageAnalytics;
  image: { data: Uint8Array; mediaType: string };
  language: string;
  scene: ImageScene;
  serviceTier?: ServiceTier;
}): Promise<ImageReview> {
  if (await isBlank(image.data)) {
    return { problems: [BLANK_FRAME], usable: false };
  }

  const { data: verdict } = await checkLessonImage({
    analytics,
    image,
    language,
    scene,
    serviceTier,
  });

  if (!verdict.passed) {
    logInfo("[images] Generated image failed its check", {
      labels: scene.labels.map((label) => label.text),
      problems: verdict.problems,
      scene,
    });
  }

  return { problems: verdict.problems, usable: verdict.passed };
}

export async function drawImage({
  attempts = DEFAULT_ATTEMPTS,
  ...input
}: DrawImageInput): Promise<DrawnImage | null> {
  if (attempts <= 0) {
    return null;
  }

  const { data, provenance } = await generateLessonImage(input);
  const image = data.image.uint8Array;

  if (!(await isBlank(image))) {
    return { image, provenance };
  }

  logInfo("[images] Generated image is a blank frame", { scene: input.scene });
  return drawImage({ ...input, attempts: attempts - 1, corrections: [BLANK_FRAME] });
}

export async function drawCheckedImage({
  attempts = DEFAULT_ATTEMPTS,
  serviceTier,
  ...input
}: DrawImageInput & { serviceTier?: ServiceTier }): Promise<DrawnImage | null> {
  if (attempts <= 0) {
    return null;
  }

  const { data, provenance } = await generateLessonImage(input);
  const image = { data: data.image.uint8Array, mediaType: data.image.mediaType };

  const review = await reviewImage({
    analytics: input.analytics,
    image,
    language: input.language,
    scene: input.scene,
    serviceTier,
  });

  if (review.usable) {
    return { image: image.data, provenance };
  }

  return drawCheckedImage({
    ...input,
    attempts: attempts - 1,
    corrections: review.problems,
    serviceTier,
  });
}
