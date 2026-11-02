import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { studySessionPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { readPathParams } from "@/lib/request-input";
import { startSessionPreparation } from "@/lib/session-preparation";
import { NextResponse } from "next/server";

const ACCEPTED = 202;

async function createPreparation(
  _request: Request,
  context: RouteContext<"/v1/study-sessions/[sessionId]/preparations">,
) {
  const path = await readPathParams(context, studySessionPathParamsSchema);

  const result = await startSessionPreparation({ sessionId: path.sessionId });

  if (result.status === "unauthorized") {
    return errors.unauthorized();
  }

  if (result.status === "notFound") {
    return errors.notFound();
  }

  return NextResponse.json({ preparationId: result.preparationId }, { status: ACCEPTED });
}

export const POST = withApiErrorBoundary(createPreparation);
