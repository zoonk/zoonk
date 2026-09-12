import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { toLearningPath } from "@/lib/learning-plan-responses";
import { trackPathParamsSchema } from "@/lib/openapi/schemas/tracks";
import { parsePathParams } from "@/lib/path-params";
import { toTrackResponse } from "@/lib/track-response";
import { startCurrentUserTrack } from "@zoonk/core/courses/tracks";
import { NextResponse } from "next/server";

async function startTrack(
  _request: Request,
  context: RouteContext<"/v1/me/tracks/[trackId]/start">,
) {
  const path = parsePathParams({ params: await context.params, schema: trackPathParamsSchema });

  if (!path.success) {
    return errors.validation(path.error);
  }

  const result = await startCurrentUserTrack(path.data);

  if (result.status === "limitReached") {
    return errors.generationLimitReached(result.limit);
  }

  if (result.status === "unauthorized") {
    return errors.unauthorized();
  }

  if (result.status === "notFound") {
    return errors.notFound();
  }

  if (result.status === "unavailable") {
    return errors.unprocessableEntity("The next course has no available teaching yet");
  }

  if (result.status === "invalid") {
    return errors.unprocessableEntity("The selected course path needs an update");
  }

  if (result.status === "conflict") {
    return errors.conflict("The selected course changed; reload and retry");
  }

  if (result.status === "ready") {
    return NextResponse.json(toLearningPath(result));
  }

  if (result.status === "completed") {
    return NextResponse.json({ status: result.status, track: toTrackResponse(result.track) });
  }

  return NextResponse.json(result);
}
export const POST = withApiErrorBoundary(startTrack);
