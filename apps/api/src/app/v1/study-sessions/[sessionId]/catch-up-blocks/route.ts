import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { parseBody } from "@/lib/body-parser";
import { studySessionPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { parsePathParams } from "@/lib/path-params";
import { studySessionError } from "@/lib/study-session-errors";
import { serializeStudySession } from "@/lib/study-session-serializers";
import { catchUpToday } from "@zoonk/core/sessions/catch-up";
import { studySessionTimeZoneInputSchema } from "@zoonk/core/sessions/contract";
import { type NextRequest, NextResponse } from "next/server";

/** "Catch up today": the lessons earlier days left that today's time didn't fit join today. */
async function createCatchUpBlocks(
  request: NextRequest,
  context: RouteContext<"/v1/study-sessions/[sessionId]/catch-up-blocks">,
) {
  const [body, path] = await Promise.all([
    parseBody(request, studySessionTimeZoneInputSchema),
    context.params.then((params) =>
      parsePathParams({ params, schema: studySessionPathParamsSchema }),
    ),
  ]);

  if (!path.success) {
    return errors.validation(path.error);
  }

  if (!body.success) {
    return errors.validation(body.error);
  }

  const result = await catchUpToday({ input: body.data, sessionId: path.data.sessionId });

  if (result.status !== "ready") {
    return studySessionError(result);
  }

  return NextResponse.json(serializeStudySession(result.session));
}

export const POST = withApiErrorBoundary(createCatchUpBlocks);
