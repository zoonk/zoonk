import { type LearnerSummaryResponse } from "@/lib/learner/learner-summary-response";
import { getLearnerSummary } from "@zoonk/core/learner/summary";
import { NextResponse } from "next/server";

/**
 * The learner summary for the browser's store (`lib/learner/learner-store.ts`) on pages whose render
 * doesn't stream it in: the catalog, the public pages and the player's screens. It only reads, and
 * the browser keeps it in memory (never in an HTTP cache). It never writes the session hint: only
 * the auth responses that set or delete the session cookie do (`@zoonk/auth/session-hint`).
 */
export async function GET(): Promise<NextResponse<LearnerSummaryResponse>> {
  const summary = await getLearnerSummary();

  const body: LearnerSummaryResponse = summary
    ? { status: "ready", summary }
    : { readAt: Date.now(), status: "visitor" };

  return NextResponse.json(body, { headers: { "Cache-Control": "private, no-store" } });
}
