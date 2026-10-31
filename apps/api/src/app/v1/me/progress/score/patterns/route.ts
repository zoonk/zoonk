import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { serializeScorePatterns } from "@/lib/progress-serializers";
import { getCurrentUserScorePatterns } from "@zoonk/core/progress/get-score-patterns";
import { NextResponse } from "next/server";

async function getCurrentUserScorePatternsRoute() {
  const resource = await getCurrentUserScorePatterns();

  if (!resource) {
    return errors.unauthorized();
  }

  return NextResponse.json({
    patterns: resource.patterns ? serializeScorePatterns(resource.patterns) : null,
  });
}

export const GET = withApiErrorBoundary(getCurrentUserScorePatternsRoute);
