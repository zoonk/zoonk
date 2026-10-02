import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { getOnboardingResume } from "@zoonk/core/view-models/onboarding/resume";
import { NextResponse } from "next/server";

/** What the learner should continue: a typed goal to confirm, a goal's onboarding, or their day. */
async function getMyOnboardingResume() {
  const result = await getOnboardingResume();

  if (result.status === "unauthorized") {
    return errors.unauthorized();
  }

  return NextResponse.json({ resume: result.resume });
}

export const GET = withApiErrorBoundary(getMyOnboardingResume);
