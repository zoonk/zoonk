import { withApiErrorBoundary } from "@/lib/api-handler";
import { conversationRefusalError } from "@/lib/language-errors";
import { readBody } from "@/lib/request-input";
import { languageConversationStartInputSchema } from "@zoonk/core/language/conversations/contract";
import { startLanguageConversation } from "@zoonk/core/language/conversations/start";
import { type NextRequest, NextResponse } from "next/server";

const CREATED = 201;

/**
 * Starts a live conversation: practice for a language unit, a language goal's checkpoint call, an
 * IELTS or TOEFL speaking mock, or a task of an exam's speaking paper (Plus, and only when the call
 * time left fits it). Nothing is charged until the call connects.
 */
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
