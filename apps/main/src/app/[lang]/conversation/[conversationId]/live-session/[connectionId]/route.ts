import { postAsLearner } from "@/lib/api/learner-api";
import { isSameOriginRequest } from "@/lib/http/is-same-origin-request";
import { liveCallSdpInputSchema } from "@zoonk/core/language/conversations/contract";
import { z } from "zod";

const pathSchema = z.object({ connectionId: z.uuid(), conversationId: z.uuid() });

const HTTP_OK = 200;
const HTTP_NO_CONTENT = 204;
const HTTP_UNAVAILABLE = 503;

type LiveSessionContext =
  RouteContext<"/[lang]/conversation/[conversationId]/live-session/[connectionId]">;

/**
 * A same-origin transport route for the browser's call, kept out of the public API: POST brokers
 * the SDK's WebRTC offer, DELETE ends the call when its tab closes (a keepalive request from
 * `pagehide`, which can't wait for a Server Action). Both are cookie-authenticated and refuse
 * cross-origin requests; the API owns admission, the session's configuration and ending it.
 */
export async function POST(request: Request, context: LiveSessionContext) {
  if (!isSameOriginRequest(request.headers)) {
    return new Response(null, { status: 403 });
  }

  const [path, body] = await Promise.all([
    context.params.then((params) => pathSchema.safeParse(params)),
    request.json().then(
      (json: unknown) => liveCallSdpInputSchema.safeParse(json),
      () => null,
    ),
  ]);

  if (!path.success || !body?.success) {
    return new Response(null, { status: 400 });
  }

  const { conversationId, connectionId } = path.data;

  const result = await postAsLearner({
    body: body.data,
    path: `/v1/language-conversations/${conversationId}/connections/${connectionId}/sdp`,
  });

  return Response.json(result.json, {
    headers: { "Cache-Control": "no-store" },
    status: result.ok ? HTTP_OK : (result.status ?? HTTP_UNAVAILABLE),
  });
}

/** Ends the call from a closing tab: the API hangs it up and charges only the time it ran. */
export async function DELETE(request: Request, context: LiveSessionContext) {
  if (!isSameOriginRequest(request.headers)) {
    return new Response(null, { status: 403 });
  }

  const path = pathSchema.safeParse(await context.params);

  if (!path.success) {
    return new Response(null, { status: 400 });
  }

  const { conversationId, connectionId } = path.data;

  const result = await postAsLearner({
    path: `/v1/language-conversations/${conversationId}/connections/${connectionId}/end`,
  });

  return new Response(null, {
    headers: { "Cache-Control": "no-store" },
    status: result.ok ? HTTP_NO_CONTENT : (result.status ?? HTTP_UNAVAILABLE),
  });
}
