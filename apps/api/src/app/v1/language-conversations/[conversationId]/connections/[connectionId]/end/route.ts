import { withApiErrorBoundary } from "@/lib/api-handler";
import { conversationRefusalError } from "@/lib/language-errors";
import { languageConversationConnectionPathParamsSchema } from "@/lib/openapi/schemas/language";
import { readPathParams } from "@/lib/request-input";
import { endLanguageConversationConnection } from "@zoonk/core/language/conversations/end-connection";
import { NextResponse } from "next/server";

/** Stops provider billing before the client drops its peer; feedback is a separate completion. */
async function endConnection(
  _request: Request,
  context: RouteContext<"/v1/language-conversations/[conversationId]/connections/[connectionId]/end">,
) {
  const path = await readPathParams(context, languageConversationConnectionPathParamsSchema);

  const result = await endLanguageConversationConnection(path);

  if (result.status !== "closed") {
    return conversationRefusalError({ status: result.status });
  }

  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}

export const POST = withApiErrorBoundary(endConnection);
