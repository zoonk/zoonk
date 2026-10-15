import "server-only";
import { safeAsync } from "@zoonk/utils/error";
import { logError } from "@zoonk/utils/logger";
import { isSameOriginRequest } from "./is-same-origin-request";

/**
 * A POST this app's screens send instead of a Server Action, for answers, grading and recordings.
 * Next.js sends a page's Server Actions one at a time, and one that changes cached data re-renders
 * the page and drops every page the browser prefetched: an answer saved in the background would
 * hold up grading the next one, and every answer would cost a page render. These run side by side
 * and leave the router alone. The session cookie authenticates them, so only this app's own pages
 * may send them (another site's form or script gets a 403), as Server Actions check too.
 * `respond` returns the screen's outcome, sent as JSON; a failure is a 500, which the screen
 * treats as not having gone through.
 */
export function appPostRoute<Params>(
  name: string,
  respond: (request: Request, params: Params) => Promise<unknown>,
) {
  return async (request: Request, context: { params: Promise<Params> }): Promise<Response> => {
    if (!isSameOriginRequest(request.headers)) {
      return new Response(null, { status: 403 });
    }

    const { data, error } = await safeAsync(async () => respond(request, await context.params));

    if (error) {
      logError(`[${name}] Failed to respond:`, error);
      return new Response(null, { status: 500 });
    }

    return Response.json(data);
  };
}

/** The request's JSON body, or null when it has none or it isn't JSON. */
export function readJsonBody(request: Request): Promise<unknown> {
  return request.json().catch(() => null);
}
