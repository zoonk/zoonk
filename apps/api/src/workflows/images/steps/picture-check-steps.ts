import { type ImageScene } from "@zoonk/ai/tasks/images/scene-schema";
import {
  type ImageAssetCheck,
  type PictureRedraw,
  checkImageAsset,
  claimPictureCheck,
  planImageAssetAgain,
  redrawImageAsset,
  removeImageAsset,
  replaceImageAsset,
} from "@zoonk/core/library/media/check-image";

export type PictureAnalytics = Parameters<typeof checkImageAsset>[0]["analytics"];

export async function checkPictureStep(
  input: Parameters<typeof checkImageAsset>[0],
): Promise<ImageAssetCheck> {
  "use step";

  return checkImageAsset(input);
}

export async function claimPictureCheckStep(assetId: string): Promise<boolean> {
  "use step";

  return claimPictureCheck(assetId);
}

export async function planPictureAgainStep(
  input: Parameters<typeof planImageAssetAgain>[0],
): Promise<ImageScene> {
  "use step";

  return planImageAssetAgain(input);
}

export async function redrawPictureStep(
  input: Parameters<typeof redrawImageAsset>[0],
): Promise<PictureRedraw> {
  "use step";

  return redrawImageAsset(input);
}

export async function replacePictureStep(
  input: Parameters<typeof replaceImageAsset>[0],
): Promise<void> {
  "use step";

  await replaceImageAsset(input);
}

export async function removePictureStep(assetId: string): Promise<void> {
  "use step";

  await removeImageAsset({ assetId });
}
