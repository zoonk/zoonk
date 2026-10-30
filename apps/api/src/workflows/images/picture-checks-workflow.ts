import { checkPictureStep } from "./steps/picture-check-steps";

export type PictureChecksInput = {
  analytics?: Parameters<typeof checkPictureStep>[0]["analytics"];
  assetIds: string[];
};

type PictureChecksResult = { passed: number; removed: number; replaced: number };

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
