import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { conversationRefusalError } from "@/lib/language-errors";
import { languageConversationPathParamsSchema } from "@/lib/openapi/schemas/language";
import { parsePathParams } from "@/lib/path-params";
import { connectLanguageConversation } from "@zoonk/core/language/conversations/connect";
import { NextResponse } from "next/server";

const CREATED = 201;

/**
 * Opens the call: holds its length from the day's call time on the learner's plan and returns a
 * short-lived token for GPT-Live with the Live WebSocket to open and how long the call may run.
 * The app talks to the model directly with it.
 */
async function connectConversation(
  _request: Request,
  context: RouteContext<"/v1/language-conversations/[conversationId]/connections">,
) {
  const path = parsePathParams({
    params: await context.params,
    schema: languageConversationPathParamsSchema,
  });

  if (!path.success) {
    return errors.validation(path.error);
  }

  const result = await connectLanguageConversation(path.data.conversationId);

  if (result.status !== "ready") {
    return conversationRefusalError(result);
  }

  return NextResponse.json(result.setup, {
    headers: { "Cache-Control": "no-store" },
    status: CREATED,
  });
}

export const POST = withApiErrorBoundary(connectConversation);
