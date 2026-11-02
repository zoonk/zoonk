import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { getLearnerSummary } from "@zoonk/core/learner/summary";
import { getRequestCountry } from "@zoonk/utils/locale-request";
import { resolveUsageDataSharing } from "@zoonk/utils/usage-data";
import { NextResponse } from "next/server";

async function getCurrentUserSummary(request: Request) {
  const summary = await getLearnerSummary();

  if (!summary) {
    return errors.unauthorized();
  }

  const usageDataSharing = resolveUsageDataSharing({
    choice: summary.analytics.shareUsageData,
    country: getRequestCountry(request.headers),
  });

  return NextResponse.json(
    { summary: { ...summary, analytics: { ...summary.analytics, usageDataSharing } } },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}

export const GET = withApiErrorBoundary(getCurrentUserSummary);
