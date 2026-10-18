import { checkPictureStep } from "./steps/picture-check-steps";

export type PictureChecksInput = {
  /** Who the pictures were drawn for, so the checks' cost adds up with them. */
  analytics?: Parameters<typeof checkPictureStep>[0]["analytics"];
  assetIds: string[];
};

type PictureChecksResult = { passed: number; removed: number; replaced: number };

/**
 * Checks pictures that are already shown, each in its own step so one retries alone: questions
 * get their pictures as soon as they're drawn, and this checks them after, at the flex tier,
 * replacing a picture it rejects with a redraw that passes (see `checkImageAsset`).
 */
export async function pictureChecksWorkflow({
  analytics,
  assetIds,
}: PictureChecksInput): Promise<PictureChecksResult> {
  "use workflow";

  const checks = await Promise.allSettled(
    assetIds.map((assetId) => checkPictureStep({ analytics, assetId })),
  );

  const statuses = checks.map((check) =>
    check.status === "fulfilled" ? check.value.status : null,
  );

  return {
    passed: statuses.filter((status) => status === "passed").length,
    removed: statuses.filter((status) => status === "removed").length,
    replaced: statuses.filter((status) => status === "replaced").length,
  };
}
