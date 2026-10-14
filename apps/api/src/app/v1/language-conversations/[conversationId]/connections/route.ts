import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { parseBody } from "@/lib/body-parser";
import { conversationRefusalError } from "@/lib/language-errors";
import { scheduleLiveCallDeadline } from "@/lib/live-call-deadline";
import { languageConversationPathParamsSchema } from "@/lib/openapi/schemas/language";
import { parsePathParams } from "@/lib/path-params";
import { connectLanguageConversation } from "@zoonk/core/language/conversations/connect";
import { languageConversationConnectInputSchema } from "@zoonk/core/language/conversations/contract";
import { type NextRequest, NextResponse } from "next/server";

const CREATED = 201;

/** Reserves the call and persists a durable deadline receipt before any SDP can be redeemed. */
async function connectConversation(
  request: NextRequest,
  context: RouteContext<"/v1/language-conversations/[conversationId]/connections">,
) {
  const [body, path] = await Promise.all([
    parseBody(request, languageConversationConnectInputSchema, { emptyBody: {} }),
    context.params.then((params) =>
      parsePathParams({ params, schema: languageConversationPathParamsSchema }),
    ),
  ]);

  if (!path.success) {
    return errors.validation(path.error);
  }

  if (!body.success) {
    return errors.validation(body.error);
  }

  const result = await connectLanguageConversation({
    conversationId: path.data.conversationId,
    input: body.data,
    scheduleDeadline: scheduleLiveCallDeadline,
  });

  if (result.status !== "ready") {
    return conversationRefusalError(result);
  }

  return NextResponse.json(result.setup, {
    headers: { "Cache-Control": "no-store" },
    status: CREATED,
  });
}

export const POST = withApiErrorBoundary(connectConversation);
