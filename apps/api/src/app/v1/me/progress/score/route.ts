import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { serializeScore } from "@/lib/progress-serializers";
import { getCurrentUserScore } from "@zoonk/core/progress/get-score-history";
import { NextResponse } from "next/server";

/**
 * Returns the authenticated learner's weighted rolling Score and date-only
 * weekly history without leaking server-localized chart labels.
 */
async function getCurrentUserScoreRoute() {
  const resource = await getCurrentUserScore();

  if (!resource) {
    return errors.unauthorized();
  }

  return NextResponse.json({ score: resource.score ? serializeScore(resource.score) : null });
}

export const GET = withApiErrorBoundary(getCurrentUserScoreRoute);
