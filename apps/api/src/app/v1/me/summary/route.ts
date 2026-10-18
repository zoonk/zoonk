import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { getLearnerSummary } from "@zoonk/core/learner/summary";
import { NextResponse } from "next/server";

/**
 * What an app's frame shows about the learner (or guest) in one read: their goals, buddy, today's
 * queue and missions, places, plan and analytics settings. It only reads saved state.
 */
async function getCurrentUserSummary() {
  const summary = await getLearnerSummary();

  if (!summary) {
    return errors.unauthorized();
  }

  return NextResponse.json({ summary }, { headers: { "Cache-Control": "private, no-store" } });
}

export const GET = withApiErrorBoundary(getCurrentUserSummary);
