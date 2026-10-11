import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { parseBody } from "@/lib/body-parser";
import { conversationRefusalError, languageError } from "@/lib/language-errors";
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
  const parsed = await parseBody(request, languageConversationStartInputSchema);

  if (!parsed.success) {
    return errors.validation(parsed.error);
  }

  const result = await startLanguageConversation(parsed.data);

  if (result.status === "limitReached") {
    return conversationRefusalError(result);
  }

  if (result.status !== "ready") {
    return languageError(result.status, "Unit or checkpoint not found");
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
