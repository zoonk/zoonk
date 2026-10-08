"use server";

import { dismissGoalUploadRequest } from "@zoonk/core/library/sources/upload-request";
import { safeAsync } from "@zoonk/utils/error";
import { logError } from "@zoonk/utils/logger";
import { z } from "zod";

const goalIdSchema = z.uuid();

/**
 * "Not now" on the ask for the notice research couldn't find: the same core capability as
 * `DELETE /v1/goals/{goalId}/upload-request`. Core checks the goal is the learner's.
 */
export async function dismissUploadRequestAction(goalId: string): Promise<boolean> {
  const parsed = goalIdSchema.safeParse(goalId);

  if (!parsed.success) {
    return false;
  }

  const { data: result, error } = await safeAsync(() =>
    dismissGoalUploadRequest({ goalId: parsed.data }),
  );

  if (error) {
    logError("[dismissUploadRequestAction] Failed to dismiss an upload request:", error);
    return false;
  }

  return result.status === "dismissed";
}
