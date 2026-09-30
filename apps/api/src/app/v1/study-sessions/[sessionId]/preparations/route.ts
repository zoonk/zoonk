import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { studySessionPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { parsePathParams } from "@/lib/path-params";
import { startSessionPreparation } from "@/lib/session-preparation";
import { NextResponse } from "next/server";

const ACCEPTED = 202;

/**
 * Prepares content around one of the learner's study sessions: this session's and the next one's
 * lessons get written. Clients call it when the learner starts studying or moves the session
 * along (the web app does on every block it opens), never on a screen view. Guests are accepted
 * and skipped.
 */
async function createPreparation(
  _request: Request,
  context: RouteContext<"/v1/study-sessions/[sessionId]/preparations">,
) {
  const path = parsePathParams({
    params: await context.params,
    schema: studySessionPathParamsSchema,
  });

  if (!path.success) {
    return errors.validation(path.error);
  }

  const result = await startSessionPreparation({ sessionId: path.data.sessionId });

  if (result.status === "unauthorized") {
    return errors.unauthorized();
  }

  if (result.status === "notFound") {
    return errors.notFound();
  }

  return NextResponse.json({ preparationId: result.preparationId }, { status: ACCEPTED });
}

export const POST = withApiErrorBoundary(createPreparation);
