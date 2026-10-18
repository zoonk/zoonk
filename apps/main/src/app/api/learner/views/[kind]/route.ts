import { type TodayScreenData, loadTodayScreen } from "@/app/[lang]/(app)/(learn)/today/today-view";
import { type LearnerViewResponse } from "@/lib/learner/learner-view-copies";
import { stringifyLearnerView } from "@/lib/learner/view-json";

/** The views a learner's screens read again on their own (`useLearnerView`). */
const VIEW_KINDS = new Set(["today"]);

function respond(body: LearnerViewResponse<TodayScreenData>): Response {
  return new Response(stringifyLearnerView(body), {
    headers: { "Cache-Control": "private, no-store", "Content-Type": "application/json" },
  });
}

/**
 * One of the learner's views for the browser's store (`lib/learner/learner-views.ts`), read when a
 * screen showing it is old, instead of rendering the page again. It only reads, through the same
 * loader as the page, so the view it sends draws exactly as the page's own copy; the browser keeps
 * it in memory, never in an HTTP cache. Any state the page draws itself (no session, no goal, a
 * paused goal) comes back as `elsewhere`, named, and the page reads itself again for it.
 */
export async function GET(
  _request: Request,
  { params }: RouteContext<"/api/learner/views/[kind]">,
): Promise<Response> {
  const { kind } = await params;

  if (!VIEW_KINDS.has(kind)) {
    return new Response(null, { status: 404 });
  }

  const result = await loadTodayScreen();

  return respond(
    result.status === "ready"
      ? { copy: result.copy, status: "ready" }
      : {
          revision: "revision" in result ? result.revision : null,
          state: result.status,
          status: "elsewhere",
        },
  );
}
