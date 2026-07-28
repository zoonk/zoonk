import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { serializeLevel } from "@/lib/progress-serializers";
import { getCurrentUserLevel } from "@zoonk/core/progress/get-belt-level";
import { NextResponse } from "next/server";

/**
 * Returns the authenticated learner's current belt and level progression while
 * preserving null for a learner who has not begun learning.
 */
async function getCurrentUserLevelRoute() {
  const resource = await getCurrentUserLevel();

  if (!resource) {
    return errors.unauthorized();
  }

  return NextResponse.json({ level: resource.level ? serializeLevel(resource.level) : null });
}

export const GET = withApiErrorBoundary(getCurrentUserLevelRoute);
