import { withApiErrorBoundary } from "@/lib/api-handler";
import { conversationRefusalError } from "@/lib/language-errors";
import { scheduleLiveCallDeadline } from "@/lib/live-call-deadline";
import { languageConversationPathParamsSchema } from "@/lib/openapi/schemas/language";
import { readBody, readPathParams } from "@/lib/request-input";
import { connectLanguageConversation } from "@zoonk/core/language/conversations/connect";
import { languageConversationConnectInputSchema } from "@zoonk/core/language/conversations/contract";
import { type NextRequest, NextResponse } from "next/server";

const CREATED = 201;

async function connectConversation(
  request: NextRequest,
  context: RouteContext<"/v1/language-conversations/[conversationId]/connections">,
) {
  const [body, path] = await Promise.all([
    readBody(request, languageConversationConnectInputSchema, { emptyBody: {} }),
    readPathParams(context, languageConversationPathParamsSchema),
  ]);

  const result = await connectLanguageConversation({
    conversationId: path.conversationId,
    input: body,
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
