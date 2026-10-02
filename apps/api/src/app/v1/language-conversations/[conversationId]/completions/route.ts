import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { parseBody } from "@/lib/body-parser";
import { languageError } from "@/lib/language-errors";
import { languageConversationPathParamsSchema } from "@/lib/openapi/schemas/language";
import { parsePathParams } from "@/lib/path-params";
import { completeLanguageConversation } from "@zoonk/core/language/conversations/complete";
import { languageConversationCompletionInputSchema } from "@zoonk/core/language/conversations/contract";
import { type NextRequest, NextResponse } from "next/server";

/**
 * Ends a call with its transcript and the goals met: a separate model writes the feedback, the
 * call counts toward today, and a checkpoint call closes the unit when won. Repeating it returns
 * the same result.
 */
async function completeConversation(
  request: NextRequest,
  context: RouteContext<"/v1/language-conversations/[conversationId]/completions">,
) {
  const [body, path] = await Promise.all([
    parseBody(request, languageConversationCompletionInputSchema),
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

  const result = await completeLanguageConversation({
    conversationId: path.data.conversationId,
    input: body.data,
  });

  if (result.status !== "completed") {
    return languageError(result.status, "Conversation not found");
  }

  return NextResponse.json(result.conversation);
}

export const POST = withApiErrorBoundary(completeConversation);
