import "server-only";
import { getImagePalette } from "@zoonk/ai/tasks/v2/images/style";
import { type MediaAsset } from "@zoonk/db";
import { drawCheckedImage } from "./draw-checked-image";
import { type ImageAnalytics, type ImagePlan } from "./plan-library-image";
import { saveImageAsset } from "./save-image-asset";

/** Draws a planned image, checks it and saves it. Returns null when no attempt passes the check. */
export async function drawPlannedImage({
  analytics,
  plan,
}: {
  analytics?: ImageAnalytics;
  plan: ImagePlan;
}): Promise<MediaAsset | null> {
  const drawn = await drawCheckedImage({
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
