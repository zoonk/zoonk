import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { conversationRefusalError } from "@/lib/language-errors";
import { languageConversationConnectionPathParamsSchema } from "@/lib/openapi/schemas/language";
import { parsePathParams } from "@/lib/path-params";
import { endLanguageConversationConnection } from "@zoonk/core/language/conversations/end-connection";
import { NextResponse } from "next/server";

/** Stops provider billing before the client drops its peer; feedback is a separate completion. */
async function endConnection(
  _request: Request,
  context: RouteContext<"/v1/language-conversations/[conversationId]/connections/[connectionId]/end">,
) {
  const path = parsePathParams({
    params: await context.params,
    schema: languageConversationConnectionPathParamsSchema,
  });

  if (!path.success) {
    return errors.validation(path.error);
  }

  const result = await endLanguageConversationConnection(path.data);

  if (result.status !== "closed") {
    return conversationRefusalError({ status: result.status });
  }

  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}

export const POST = withApiErrorBoundary(endConnection);
