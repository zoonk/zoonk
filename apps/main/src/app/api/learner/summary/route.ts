import { type LearnerSummaryResponse } from "@/lib/learner/learner-summary-response";
import { getLearnerSummary } from "@zoonk/core/learner/summary";
import { NextResponse } from "next/server";

/** Never writes the session hint: only the auth responses that set or delete the session cookie do. */
export async function GET(): Promise<NextResponse<LearnerSummaryResponse>> {
  const summary = await getLearnerSummary();

  const body: LearnerSummaryResponse = summary
    ? { status: "ready", summary }
    : { readAt: Date.now(), status: "visitor" };

  return NextResponse.json(body, { headers: { "Cache-Control": "private, no-store" } });
}
