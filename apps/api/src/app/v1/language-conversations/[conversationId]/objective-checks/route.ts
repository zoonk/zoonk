import { withApiErrorBoundary } from "@/lib/api-handler";
import { languageError } from "@/lib/language-errors";
import { languageConversationPathParamsSchema } from "@/lib/openapi/schemas/language";
import { readBody, readPathParams } from "@/lib/request-input";
import { checkLanguageConversationObjectives } from "@zoonk/core/language/conversations/check-objectives";
import { languageConversationObjectiveCheckInputSchema } from "@zoonk/core/language/conversations/contract";
import { type NextRequest, NextResponse } from "next/server";

async function checkObjectives(
  request: NextRequest,
  context: RouteContext<"/v1/language-conversations/[conversationId]/objective-checks">,
) {
  const [body, path] = await Promise.all([
    readBody(request, languageConversationObjectiveCheckInputSchema),
    readPathParams(context, languageConversationPathParamsSchema),
  ]);

  const result = await checkLanguageConversationObjectives({
    conversationId: path.conversationId,
    input: body,
  });

  if (result.status !== "ready") {
    return languageError(result.status, "Conversation not found");
  }

  return NextResponse.json({ objectivesMet: result.objectivesMet });
}

export const POST = withApiErrorBoundary(checkObjectives);
