import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { parseBody } from "@/lib/body-parser";
import { trackPathParamsSchema, trackUpdateRequestSchema } from "@/lib/openapi/schemas/tracks";
import { parsePathParams } from "@/lib/path-params";
import { toTrackResponse } from "@/lib/track-response";
import {
  getCurrentUserTrack,
  removeCurrentUserTrack,
  updateCurrentUserTrack,
} from "@zoonk/core/courses/tracks";
import { type NextRequest, NextResponse } from "next/server";

async function getTrack(_request: Request, context: RouteContext<"/v1/me/tracks/[trackId]">) {
  const parsed = parsePathParams({ params: await context.params, schema: trackPathParamsSchema });

  if (!parsed.success) {
    return errors.validation(parsed.error);
  }

  const result = await getCurrentUserTrack(parsed.data);

  if (result.status === "unauthorized") {
    return errors.unauthorized();
  }

  if (result.status === "notFound") {
    return errors.notFound();
  }

  return NextResponse.json(toTrackResponse(result.track));
}

async function updateTrack(request: NextRequest, context: RouteContext<"/v1/me/tracks/[trackId]">) {
  const parsedPath = parsePathParams({
    params: await context.params,
    schema: trackPathParamsSchema,
  });

  if (!parsedPath.success) {
    return errors.validation(parsedPath.error);
  }

  const parsedBody = await parseBody(request, trackUpdateRequestSchema);

  if (!parsedBody.success) {
    return errors.validation(parsedBody.error);
  }

  const result = await updateCurrentUserTrack({
    input: parsedBody.data,
    trackId: parsedPath.data.trackId,
  });

  if (result.status === "unauthorized") {
    return errors.unauthorized();
  }

  if (result.status === "notFound") {
    return errors.notFound();
  }

  if (result.status === "invalid") {
    return errors.badRequest("Invalid learning track");
  }

  if (result.status === "conflict") {
    return errors.conflict("The Track changed; reload before saving");
  }

  return NextResponse.json(toTrackResponse(result.track));
}

async function removeTrack(_request: Request, context: RouteContext<"/v1/me/tracks/[trackId]">) {
  const parsed = parsePathParams({ params: await context.params, schema: trackPathParamsSchema });

  if (!parsed.success) {
    return errors.validation(parsed.error);
  }

  const result = await removeCurrentUserTrack(parsed.data);

  if (result.status === "unauthorized") {
    return errors.unauthorized();
  }

  if (result.status === "notFound") {
    return errors.notFound();
  }

  return new NextResponse(null, { status: 204 });
}

export const GET = withApiErrorBoundary(getTrack);
export const PATCH = withApiErrorBoundary(updateTrack);
export const DELETE = withApiErrorBoundary(removeTrack);
