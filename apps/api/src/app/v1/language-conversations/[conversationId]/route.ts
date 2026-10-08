import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { languageError } from "@/lib/language-errors";
import { languageConversationPathParamsSchema } from "@/lib/openapi/schemas/language";
import { parsePathParams } from "@/lib/path-params";
import { getLanguageConversation } from "@zoonk/core/language/conversations/get";
import { NextResponse } from "next/server";

/** One of the learner's live conversations: before the call, what it's about; after, its result. */
async function getConversation(
  _request: Request,
  context: RouteContext<"/v1/language-conversations/[conversationId]">,
) {
  const path = parsePathParams({
    params: await context.params,
    schema: languageConversationPathParamsSchema,
  });

  if (!path.success) {
    return errors.validation(path.error);
  }

  const result = await getLanguageConversation(path.data.conversationId);

  if (result.status !== "ready") {
    return languageError(result.status, "Conversation not found");
  }

  return NextResponse.json(result.conversation, { headers: { "Cache-Control": "no-store" } });
}

export const GET = withApiErrorBoundary(getConversation);
