import { accessErrorCodes, underMinimumAgeError } from "@/lib/access-error-codes";
import { createErrorResponse, errors, httpStatus } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { parseBody } from "@/lib/body-parser";
import { learningProfileUpdateSchema } from "@zoonk/core/profile/contract";
import { getLearningProfile } from "@zoonk/core/profile/get";
import {
  type LearningProfileUpdateResult,
  updateLearningProfile,
} from "@zoonk/core/profile/update";
import { type NextRequest } from "next/server";
import { createLearningProfileResponse } from "./_utils/learning-profile-response";

/** Buddy, age answer, settings and active goal of the learner or guest in the session. */
async function getProfile() {
  const profile = await getLearningProfile();

  if (!profile) {
    return errors.unauthorized();
  }

  return createLearningProfileResponse(profile);
}

function getUpdateErrorResponse(
  result: Exclude<LearningProfileUpdateResult, { status: "updated" }>,
) {
  if (result.status === "unauthorized") {
    return errors.unauthorized();
  }

  if (result.status === "accountDeleted") {
    return underMinimumAgeError();
  }

  if (result.status === "birthChangeNeedsSupport") {
    return createErrorResponse({
      code: accessErrorCodes.birthChangeNeedsSupport,
      message: "An answer that makes the learner older is corrected by support",
      status: httpStatus.conflict,
    });
  }

  if (result.status === "goalNotFound") {
    return createErrorResponse({
      code: accessErrorCodes.goalNotFound,
      message: "Goal not found",
      status: httpStatus.notFound,
    });
  }

  return createErrorResponse({
    code: accessErrorCodes.glassesNotEarned,
    message: "These glasses haven't been earned yet",
    status: httpStatus.unprocessableEntity,
  });
}

/** Saves what a screen changed. An age under 13 deletes the account, and clients sign out. */
async function updateProfile(request: NextRequest) {
  const parsed = await parseBody(request, learningProfileUpdateSchema);

  if (!parsed.success) {
    return errors.validation(parsed.error);
  }

  const result = await updateLearningProfile(parsed.data);

  if (result.status !== "updated") {
    return getUpdateErrorResponse(result);
  }

  return createLearningProfileResponse(result.profile);
}

export const GET = withApiErrorBoundary(getProfile);
export const PATCH = withApiErrorBoundary(updateProfile);
