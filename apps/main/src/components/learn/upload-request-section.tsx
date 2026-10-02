import { getGoalUploadRequest } from "@zoonk/core/library/sources/upload-request";
import { UploadRequestClient } from "./upload-request-client";

/**
 * What research asked the learner to upload for their goal (the official notice it couldn't
 * find, or their class's material), on Plan and Today until they answer or dismiss it. Nothing
 * renders when research needs nothing.
 */
export async function UploadRequestSection({
  className,
  goalId,
}: {
  className?: string;
  goalId: string;
}) {
  const result = await getGoalUploadRequest({ goalId });

  if (result.status !== "ready" || !result.request) {
    return null;
  }

  return <UploadRequestClient className={className} request={result.request} />;
}
