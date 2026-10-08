import "server-only";
import { getImagePalette } from "@zoonk/ai/tasks/v2/images/style";
import { type MediaAsset } from "@zoonk/db";
import { drawImage } from "./draw-checked-image";
import { type ImageAnalytics, type ImagePlan } from "./plan-library-image";
import { saveImageAsset } from "./save-image-asset";

/**
 * Draws a planned image and saves it, to show at once: only the code check runs here, and the
 * caller starts its model check in the background (`checkImageAsset`), which replaces a picture it
 * rejects. Returns null when every drawing came out blank.
 */
export async function drawPlannedImage({
  analytics,
  plan,
}: {
  analytics?: ImageAnalytics;
  plan: ImagePlan;
}): Promise<MediaAsset | null> {
  const drawn = await drawImage({
    analytics,
    language: plan.language,
    palette: getImagePalette(plan.palette),
    scene: plan.scene,
  });

  if (!drawn) {
    return null;
  }

  return saveImageAsset({
    image: drawn.image,
    language: plan.labelLanguage,
    ownerId: plan.ownerId,
    palette: plan.palette,
    prompt: plan.prompt,
    provenance: drawn.provenance,
    reuseKey: plan.reuseKey,
    scene: plan.scene,
  });
}
