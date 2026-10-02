import "server-only";
import { checkLessonImage } from "@zoonk/ai/tasks/v2/images/check";
import { type LessonImageParams, generateLessonImage } from "@zoonk/ai/tasks/v2/images/generate";
import { type ImageScene } from "@zoonk/ai/tasks/v2/images/scene-schema";
import { logInfo } from "@zoonk/utils/logger";
import { isNearSolidImage } from "../../../images/image-quality";
import { type LibraryProvenance } from "../../_utils/library-rows";

/** A failed image is made once more; if that fails too, the screen goes without one. */
const DEFAULT_ATTEMPTS = 2;

type ImageAnalytics = LessonImageParams["analytics"];

export type DrawImageInput = Omit<LessonImageParams, "model" | "quality"> & {
  /** How many images to try before giving up. */
  attempts?: number;
};

export type DrawnImage = { image: Uint8Array; provenance: LibraryProvenance };

/** Whether an image can be used and, when it can't, what to fix in the next attempt. */
type ImageReview = { usable: boolean; problems: string[] };

/**
 * The check before an image is used: a blank frame fails without a model
 * call, then a vision model confirms it shows the scene, is on style and has
 * only short, correctly spelled labels.
 */
async function reviewImage({
  analytics,
  image,
  language,
  scene,
}: {
  analytics?: ImageAnalytics;
  image: { data: Uint8Array; mediaType: string };
  language: string;
  scene: ImageScene;
}): Promise<ImageReview> {
  const { data: isBlank, error } = await isNearSolidImage({ image: Buffer.from(image.data) });

  if (error) {
    throw error;
  }

  if (isBlank) {
    logInfo("[images] Generated image is a blank frame", { scene });
    return { problems: ["the image was a blank frame"], usable: false };
  }

  const { data: verdict } = await checkLessonImage({ analytics, image, language, scene });

  if (!verdict.passed) {
    logInfo("[images] Generated image failed its check", {
      labels: scene.labels.map((label) => label.text),
      problems: verdict.problems,
      scene,
    });
  }

  return { problems: verdict.problems, usable: verdict.passed };
}

/**
 * Draws an image and keeps it only when it passes the check, trying once more
 * after a failure with the check's findings in the prompt. Returns null when
 * no attempt passes, so the caller ships the screen without an image instead
 * of a wrong or broken one.
 */
export async function drawCheckedImage({
  attempts = DEFAULT_ATTEMPTS,
  ...input
}: DrawImageInput): Promise<DrawnImage | null> {
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
  });

  if (review.usable) {
    return { image: image.data, provenance };
  }

  return drawCheckedImage({ ...input, attempts: attempts - 1, corrections: review.problems });
}
