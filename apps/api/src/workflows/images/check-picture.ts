import { type PictureRedraw } from "@zoonk/core/library/media/check-image";
import {
  type PictureAnalytics,
  checkPictureStep,
  planPictureAgainStep,
  redrawPictureStep,
  removePictureStep,
  replacePictureStep,
} from "./steps/picture-check-steps";

export type PictureCheckStatus = "missing" | "passed" | "removed" | "replaced";

async function redrawPicture({
  alt,
  analytics,
  assetId,
  findings,
}: {
  alt?: string | null;
  analytics?: PictureAnalytics;
  assetId: string;
  findings: string[];
}): Promise<PictureRedraw | null> {
  const scene = await planPictureAgainStep({ alt, analytics, assetId, findings });
  const redraw = await redrawPictureStep({ analytics, assetId, findings, scene });
  const recheck = await checkPictureStep({ alt, analytics, assetId, redraw });

  return recheck.status === "passed" ? redraw : null;
}

/**
 * A rejected picture is planned again from what its check found and drawn once more, and keeps that
 * redraw only if it passes its own check. Otherwise it's taken out of use, also when a redraw step
 * runs out of retries.
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
  const redraw = await redrawPicture({ alt, analytics, assetId, findings }).catch(() => null);

  if (!redraw) {
    await removePictureStep(assetId);
    return "removed";
  }

  await replacePictureStep({ assetId, redraw });
  return "replaced";
}
