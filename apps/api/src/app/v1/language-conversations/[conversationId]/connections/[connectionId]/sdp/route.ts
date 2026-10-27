import { withApiErrorBoundary } from "@/lib/api-handler";
import { conversationRefusalError } from "@/lib/language-errors";
import { languageConversationConnectionPathParamsSchema } from "@/lib/openapi/schemas/language";
import { readBody, readPathParams } from "@/lib/request-input";
import { liveCallSdpInputSchema } from "@zoonk/core/language/conversations/contract";
import { redeemLiveCallSdp } from "@zoonk/core/language/conversations/redeem-sdp";
import { type NextRequest, NextResponse } from "next/server";

/** Core owns the authenticated single redemption and ignores the browser's session config. */
async function redeemSdp(
  request: NextRequest,
  context: RouteContext<"/v1/language-conversations/[conversationId]/connections/[connectionId]/sdp">,
) {
  const [body, path] = await Promise.all([
    readBody(request, liveCallSdpInputSchema),
    readPathParams(context, languageConversationConnectionPathParamsSchema),
  ]);

  const result = await redeemLiveCallSdp({ ...path, input: body });

  if (result.status !== "ready") {
    return conversationRefusalError(result);
  }

  return NextResponse.json(
    { sdp: result.sdp, sessionId: result.sessionId },
    { headers: { "Cache-Control": "no-store" }, status: 201 },
  );
}

export const POST = withApiErrorBoundary(redeemSdp);
