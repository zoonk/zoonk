import { type ImageAssetCheck, checkImageAsset } from "@zoonk/core/library/media/check-image";

type PictureAnalytics = Parameters<typeof checkImageAsset>[0]["analytics"];

export async function checkPictureStep({
  alt,
  analytics,
  assetId,
}: {
  alt?: string | null;
  analytics?: PictureAnalytics;
  assetId: string;
}): Promise<ImageAssetCheck> {
  "use step";

  return checkImageAsset({ alt, analytics, assetId });
}
