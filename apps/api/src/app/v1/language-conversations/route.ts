import { withApiErrorBoundary } from "@/lib/api-handler";
import { conversationRefusalError } from "@/lib/language-errors";
import { readBody } from "@/lib/request-input";
import { languageConversationStartInputSchema } from "@zoonk/core/language/conversations/contract";
import { startLanguageConversation } from "@zoonk/core/language/conversations/start";
import { type NextRequest, NextResponse } from "next/server";

const CREATED = 201;

async function createLanguageConversation(request: NextRequest) {
  const parsed = await readBody(request, languageConversationStartInputSchema);

  const result = await startLanguageConversation(parsed);

  if (result.status !== "ready") {
    return conversationRefusalError(result, "Unit or checkpoint not found");
  }

  return NextResponse.json(
    { conversationId: result.conversationId },
    {
      headers: { Location: `/v1/language-conversations/${result.conversationId}` },
      status: CREATED,
    },
  );
}

export const POST = withApiErrorBoundary(createLanguageConversation);
