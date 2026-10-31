import "server-only";
import { safeAsync } from "@zoonk/utils/error";
import { logError } from "@zoonk/utils/logger";
import { isSameOriginRequest } from "./is-same-origin-request";

/**
 * Instead of a Server Action: Next.js sends a page's actions one at a time, and one that changes
 * cached data re-renders the page and drops its prefetches. The session cookie authenticates these,
 * so only this app's own pages may send them. A failure is a 500, which the screen treats as unsent.
 */
export function appPostRoute<Params>(
  name: string,
  respond: (request: Request, params: Params) => Promise<unknown>,
) {
  return async (request: Request, context: { params: Promise<Params> }): Promise<Response> => {
    if (!isSameOriginRequest(request.headers)) {
      return new Response(null, { status: 403 });
    }

    const { data, error } = await safeAsync(async () =>
      Response.json(await respond(request, await context.params)),
    );

    if (error) {
      logError(`[${name}] Failed to respond:`, error);
      return new Response(null, { status: 500 });
    }

    return data;
  };
}

export function readJsonBody(request: Request): Promise<unknown> {
  return request.json().catch(() => null);
}
