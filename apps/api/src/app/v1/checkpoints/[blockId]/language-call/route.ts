import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { checkpointPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { readPathParams } from "@/lib/request-input";
import { openLanguageCheckpointCall } from "@zoonk/core/language/conversations/start";
import { NextResponse } from "next/server";

/** Returns where a language goal's checkpoint call stands, without making it. */
async function getLanguageCheckpointCall(
  _request: Request,
  context: RouteContext<"/v1/checkpoints/[blockId]/language-call">,
) {
  const path = await readPathParams(context, checkpointPathParamsSchema);
  const call = await openLanguageCheckpointCall(path.blockId);

  if (call.status === "unauthorized") {
    return errors.unauthorized();
  }

  if (call.status === "notFound") {
    return errors.notFound();
  }

  return NextResponse.json(call);
}

export const GET = withApiErrorBoundary(getLanguageCheckpointCall);
