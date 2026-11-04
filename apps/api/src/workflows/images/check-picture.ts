import {
  type PictureAnalytics,
  checkPictureStep,
  planPictureAgainStep,
  redrawPictureStep,
  removePictureStep,
  replacePictureStep,
} from "./steps/picture-check-steps";

export type PictureCheckStatus = "missing" | "passed" | "removed" | "replaced";

/**
 * A rejected picture is planned again from what its check found and drawn once more, and keeps that
 * redraw only if it passes its own check; otherwise it's taken out of use.
 */
export async function checkPicture({
  alt,
  analytics,
  assetId,
}: {
  alt?: string | null;
  analytics?: PictureAnalytics;
  assetId: string;
}): Promise<PictureCheckStatus> {
  const check = await checkPictureStep({ alt, analytics, assetId });

  if (check.status !== "rejected") {
    return check.status;
  }

  const { findings } = check;
  const scene = await planPictureAgainStep({ alt, analytics, assetId, findings });
  const redraw = await redrawPictureStep({ analytics, assetId, findings, scene });

  const recheck = await checkPictureStep({ alt, analytics, assetId, redraw });

  if (recheck.status !== "passed") {
    await removePictureStep(assetId);
    return "removed";
  }

  await replacePictureStep({ assetId, redraw });
  return "replaced";
}
