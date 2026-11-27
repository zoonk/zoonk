import { accessError, errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { goalPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { readPathParams, readQueryParams } from "@/lib/request-input";
import { buddyConversationsQuerySchema } from "@zoonk/core/lesson-questions/contract";
import { listBuddyConversations } from "@zoonk/core/lesson-questions/list-buddy-conversations";
import { NextResponse } from "next/server";

async function getConversations(request: Request, context: { params: Promise<unknown> }) {
  const { cursor } = readQueryParams(request, buddyConversationsQuerySchema);
  const { goalId } = await readPathParams(context, goalPathParamsSchema);
  const result = await listBuddyConversations({ cursor, goalId });

  if (result.status === "invalidCursor") {
    return errors.badRequest("Invalid Buddy conversation cursor");
  }

  if (result.status !== "ready") {
    return accessError(result.status);
  }

  return NextResponse.json({
    conversations: result.conversations,
    currentId: result.currentId,
    nextCursor: result.nextCursor,
  });
}

export const GET = withApiErrorBoundary(getConversations);
