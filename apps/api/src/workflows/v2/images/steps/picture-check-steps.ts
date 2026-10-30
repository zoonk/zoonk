import { type ImageAssetCheck, checkImageAsset } from "@zoonk/core/library/media/check-image";

type PictureAnalytics = Parameters<typeof checkImageAsset>[0]["analytics"];

export async function checkPictureStep({
  analytics,
  assetId,
}: {
  analytics?: PictureAnalytics;
  assetId: string;
}): Promise<ImageAssetCheck> {
  "use step";

  return checkImageAsset({ analytics, assetId });
}
