import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { listCurrentUserContinueLearningItems } from "@zoonk/core/courses/list-current-user-continue-learning";
import { NextResponse } from "next/server";

/**
 * Returns the authenticated learner's bounded continuation cards using Core's
 * shared visibility, generation, and progress rules.
 */
async function listCurrentUserCourseContinuations() {
  const items = await listCurrentUserContinueLearningItems({ requireAuthentication: true });

  if (!items) {
    return errors.unauthorized();
  }

  return NextResponse.json({ data: items });
}

export const GET = withApiErrorBoundary(listCurrentUserCourseContinuations);
