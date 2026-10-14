import { type LearnerSummaryResponse } from "@/lib/learner/learner-summary-response";
import {
  SESSION_HINT_COOKIE,
  getNoSessionHintCookie,
  getSessionHintCookie,
  saysNoSession,
} from "@/lib/learner/session-hint";
import { getLearnerSummary } from "@zoonk/core/learner/summary";
import { type NextRequest, NextResponse } from "next/server";

/**
 * The learner summary for the browser's store (`lib/learner/learner-store.ts`) on pages whose render
 * doesn't stream it in: the catalog, the public pages and the player's screens. It only reads, the
 * browser keeps it in memory (never in an HTTP cache), and it keeps the session hint in step: on
 * for a session, until it ends, and "none" once the browser has none (an expired one included),
 * so later pages of this browsing session don't ask again.
 */
export async function GET(request: NextRequest): Promise<NextResponse<LearnerSummaryResponse>> {
  const summary = await getLearnerSummary();
  const secure = request.nextUrl.protocol === "https:";

  const body: LearnerSummaryResponse = summary
    ? { status: "ready", summary }
    : { readAt: Date.now(), status: "visitor" };

  const response = NextResponse.json(body, { headers: { "Cache-Control": "private, no-store" } });

  if (summary) {
    response.headers.append(
      "Set-Cookie",
      getSessionHintCookie({ expiresAt: new Date(summary.identity.expiresAt), secure }),
    );
  } else if (!saysNoSession(request.cookies.get(SESSION_HINT_COOKIE)?.value)) {
    response.headers.append("Set-Cookie", getNoSessionHintCookie({ secure }));
  }

  return response;
}
