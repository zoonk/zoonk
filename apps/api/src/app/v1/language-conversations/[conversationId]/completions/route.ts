import { withApiErrorBoundary } from "@/lib/api-handler";
import { conversationReviewRuns } from "@/lib/conversation-review-runs";
import { languageError } from "@/lib/language-errors";
import { languageConversationPathParamsSchema } from "@/lib/openapi/schemas/language";
import { readBody, readPathParams } from "@/lib/request-input";
import { completeLanguageConversation } from "@zoonk/core/language/conversations/complete";
import { languageConversationCompletionInputSchema } from "@zoonk/core/language/conversations/contract";
import { type NextRequest, NextResponse } from "next/server";

async function completeConversation(
  request: NextRequest,
  context: RouteContext<"/v1/language-conversations/[conversationId]/completions">,
) {
  const [body, path] = await Promise.all([
    readBody(request, languageConversationCompletionInputSchema),
    readPathParams(context, languageConversationPathParamsSchema),
  ]);

  const result = await completeLanguageConversation({
    conversationId: path.conversationId,
    input: body,
    runs: conversationReviewRuns,
  });

  if (result.status !== "completed") {
    return languageError(result.status, "Conversation not found");
  }

  return NextResponse.json({
    ...result.conversation,
    ceremony: result.ceremony,
    missionMoment: result.missionMoment,
    reached: result.reached,
  });
}

export const POST = withApiErrorBoundary(completeConversation);
