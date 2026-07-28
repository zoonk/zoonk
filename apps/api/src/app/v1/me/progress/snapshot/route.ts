import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { serializeProgressSnapshot } from "@/lib/progress-serializers";
import { getCurrentUserProgressSnapshot } from "@zoonk/core/player/queries/get-player-progress-snapshot";
import { NextResponse } from "next/server";

/**
 * Returns the authenticated learner's pre-completion milestone snapshot so
 * native players can evaluate the same completion effects as the web player.
 */
async function getCurrentUserProgressSnapshotRoute() {
  const resource = await getCurrentUserProgressSnapshot();

  if (!resource) {
    return errors.unauthorized();
  }

  return NextResponse.json({ snapshot: serializeProgressSnapshot(resource.snapshot) });
}

export const GET = withApiErrorBoundary(getCurrentUserProgressSnapshotRoute);
