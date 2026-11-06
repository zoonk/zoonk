import { type PictureRedraw } from "@zoonk/core/library/media/check-image";
import { claimRunToken } from "../_shared/run-token";
import {
  type PictureAnalytics,
  checkPictureStep,
  claimPictureCheckStep,
  planPictureAgainStep,
  redrawPictureStep,
  removePictureStep,
  replacePictureStep,
} from "./steps/picture-check-steps";

export type PictureCheckStatus = "missing" | "passed" | "removed" | "replaced" | "skipped";

async function redrawPicture({
  analytics,
  assetId,
  findings,
}: {
  analytics?: PictureAnalytics;
  assetId: string;
  findings: string[];
}): Promise<PictureRedraw | null> {
  const scene = await planPictureAgainStep({ analytics, assetId, findings });
  const redraw = await redrawPictureStep({ analytics, assetId, findings, scene });
  const recheck = await checkPictureStep({ analytics, assetId, redraw });

  return recheck.status === "passed" ? redraw : null;
}

/**
 * A rejected picture is planned again from what its check found and drawn once more, and keeps that
 * redraw only if it passes its own check. Otherwise it's taken out of use, also when a redraw step
 * runs out of retries. Every run checking a picture holds its token, since two checks at once could
 * each remove the redraw the other just showed.
 */
export async function checkPicture({
  analytics,
  assetId,
}: {
  analytics?: PictureAnalytics;
  assetId: string;
}): Promise<PictureCheckStatus> {
  using claim = await claimRunToken(`picture-check:${assetId}`);

  if (claim.conflict || !(await claimPictureCheckStep(assetId))) {
    return "skipped";
  }

  const check = await checkPictureStep({ analytics, assetId });

  if (check.status !== "rejected") {
    return check.status;
  }

  const { findings } = check;
  const redraw = await redrawPicture({ analytics, assetId, findings }).catch(() => null);

  if (!redraw) {
    await removePictureStep(assetId);
    return "removed";
  }

  await replacePictureStep({ assetId, redraw });
  return "replaced";
}
