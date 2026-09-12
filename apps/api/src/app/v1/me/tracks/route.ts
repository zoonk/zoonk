import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { parseBody } from "@/lib/body-parser";
import { trackCreateRequestSchema, trackListQuerySchema } from "@/lib/openapi/schemas/tracks";
import { parseQueryParams } from "@/lib/query-params";
import { toTrackResponse } from "@/lib/track-response";
import { createCurrentUserTrack, listCurrentUserTracks } from "@zoonk/core/courses/tracks";
import { type NextRequest, NextResponse } from "next/server";

async function listTracks(request: Request) {
  const parsed = parseQueryParams(new URL(request.url).searchParams, trackListQuerySchema);

  if (!parsed.success) {
    return errors.validation(parsed.error);
  }

  const result = await listCurrentUserTracks(parsed.data);

  if (result.status === "unauthorized") {
    return errors.unauthorized();
  }

  if (result.status === "invalid") {
    return errors.badRequest("Invalid pagination cursor");
  }

  return NextResponse.json({
    data: result.tracks.map(toTrackResponse),
    pagination: { hasMore: result.nextCursor !== null, nextCursor: result.nextCursor },
  });
}

async function createTrack(request: NextRequest) {
  const parsed = await parseBody(request, trackCreateRequestSchema);

  if (!parsed.success) {
    return errors.validation(parsed.error);
  }

  const result = await createCurrentUserTrack(parsed.data);

  if (result.status === "unauthorized") {
    return errors.unauthorized();
  }

  if (result.status === "notFound") {
    return errors.notFound();
  }

  if (result.status === "invalid") {
    return errors.badRequest("Invalid learning track");
  }

  return NextResponse.json(toTrackResponse(result.track), {
    headers: { Location: `/v1/me/tracks/${result.track.id}` },
    status: 201,
  });
}

export const GET = withApiErrorBoundary(listTracks);
export const POST = withApiErrorBoundary(createTrack);
