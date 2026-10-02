import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { parseBody } from "@/lib/body-parser";
import { conversationRefusalError, languageError } from "@/lib/language-errors";
import { languageConversationPathParamsSchema } from "@/lib/openapi/schemas/language";
import { parsePathParams } from "@/lib/path-params";
import { checkLanguageConversationObjectives } from "@zoonk/core/language/conversations/check-objectives";
import { languageConversationObjectiveCheckInputSchema } from "@zoonk/core/language/conversations/contract";
import { type NextRequest, NextResponse } from "next/server";

/**
 * Marks the call's goals while the learner talks: the app sends what was said so far after each of
 * the learner's turns, and gets back every goal met so far.
 */
async function checkObjectives(
  request: NextRequest,
  context: RouteContext<"/v1/language-conversations/[conversationId]/objective-checks">,
) {
  const [body, path] = await Promise.all([
    parseBody(request, languageConversationObjectiveCheckInputSchema),
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

  const result = await checkLanguageConversationObjectives({
    conversationId: path.data.conversationId,
    input: body.data,
  });

  if (result.status === "slowDown") {
    return conversationRefusalError(result);
  }

  if (result.status !== "ready") {
    return languageError(result.status, "Conversation not found");
  }

  return NextResponse.json({ objectivesMet: result.objectivesMet });
}

export const POST = withApiErrorBoundary(checkObjectives);
