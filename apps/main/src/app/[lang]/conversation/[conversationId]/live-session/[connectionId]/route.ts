import { postAsLearner } from "@/lib/api/learner-api";
import { isSameOriginRequest } from "@/lib/http/is-same-origin-request";
import { liveCallSdpInputSchema } from "@zoonk/core/language/conversations/contract";
import { z } from "zod";

const pathSchema = z.object({ connectionId: z.uuid(), conversationId: z.uuid() });

const HTTP_OK = 200;
const HTTP_UNAVAILABLE = 503;

/** The SDK's cookie-authenticated WebRTC broker; the API owns admission, fencing and configuration. */
export async function POST(
  request: Request,
  context: RouteContext<"/[lang]/conversation/[conversationId]/live-session/[connectionId]">,
) {
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
