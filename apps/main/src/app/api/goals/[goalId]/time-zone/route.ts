import { isSameOriginRequest } from "@/lib/http/is-same-origin-request";
import { followGoalTimeZone } from "@zoonk/core/learner/follow-time-zone";
import { safeAsync } from "@zoonk/utils/error";
import { logError } from "@zoonk/utils/logger";
import { isValidTimeZone } from "@zoonk/utils/time-zone";
import { z } from "zod";

const goalIdSchema = z.uuid();
const followInputSchema = z.object({ timeZone: z.string().refine(isValidTimeZone) });

/**
 * Follows the learner to their device's zone when Today opens (the API's `GET /v1/today` does the
 * same with its `timeZone`). A plain request rather than a Server Action: an action's expired tags
 * would drop every page the browser prefetched, and an ordinary write never does. Same-origin only,
 * since it reads the session cookie. Answers whether the learner's day moved, with the learner's
 * revision when it did, so Today reads itself again once.
 */
export async function POST(
  request: Request,
  context: RouteContext<"/api/goals/[goalId]/time-zone">,
) {
  if (!isSameOriginRequest(request.headers)) {
    return new Response(null, { status: 403 });
  }

  const [{ goalId }, body] = await Promise.all([
    context.params,
    request.json().then(
      (json: unknown) => json,
      () => null,
    ),
  ]);

  const input = followInputSchema.safeParse(body ?? {});

  if (!goalIdSchema.safeParse(goalId).success || !input.success) {
    return new Response(null, { status: 400 });
  }

  const { data: result, error } = await safeAsync(() =>
    followGoalTimeZone({ goalId, timeZone: input.data.timeZone }),
  );

  if (error) {
    logError("[followTimeZoneRoute] Failed to follow the learner's time zone:", error);
    return new Response(null, { status: 500 });
  }

  if (result.status === "unauthorized") {
    return new Response(null, { status: 401 });
  }

  if (result.status === "notFound") {
    return new Response(null, { status: 404 });
  }

  return Response.json(
    result.moved ? { learnerRevision: result.learnerRevision, moved: true } : { moved: false },
  );
}
