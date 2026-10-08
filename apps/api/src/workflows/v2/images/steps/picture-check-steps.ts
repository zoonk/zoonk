import { type ImageAssetCheck, checkImageAsset } from "@zoonk/core/library/media/check-image";
import { withAiRetry } from "../../_shared/ai-retry";

type PictureAnalytics = Parameters<typeof checkImageAsset>[0]["analytics"];

/**
 * The model check of one picture already shown, at the flex tier: a picture it rejects is drawn
 * again and replaced, or taken out of use when the redraws fail too (see `checkImageAsset`).
 */
export async function checkPictureStep({
  analytics,
  assetId,
}: {
  analytics?: PictureAnalytics;
  assetId: string;
}): Promise<ImageAssetCheck> {
  "use step";

  return withAiRetry(() => checkImageAsset({ analytics, assetId }));
}
