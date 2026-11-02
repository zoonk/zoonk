import { withApiErrorBoundary } from "@/lib/api-handler";
import { conversationRefusalError } from "@/lib/language-errors";
import {
  languageConversationConnectionPathParamsSchema,
  liveCallEndResponseSchema,
} from "@/lib/openapi/schemas/language";
import { readPathParams } from "@/lib/request-input";
import { endLanguageConversationConnection } from "@zoonk/core/language/conversations/end-connection";
import { NextResponse } from "next/server";

async function endConnection(
  _request: Request,
  context: RouteContext<"/v1/language-conversations/[conversationId]/connections/[connectionId]/end">,
) {
  const path = await readPathParams(context, languageConversationConnectionPathParamsSchema);

  const result = await endLanguageConversationConnection(path);

  if (result.status !== "closed") {
    return conversationRefusalError({ status: result.status });
  }

  return NextResponse.json(liveCallEndResponseSchema.parse(result), {
    headers: { "Cache-Control": "no-store" },
  });
}

export const POST = withApiErrorBoundary(endConnection);
