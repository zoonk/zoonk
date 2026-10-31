import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { serializeCurrentUserProgress } from "@/lib/progress-serializers";
import { getCurrentUserProgress } from "@zoonk/core/progress/get-current-user";
import { NextResponse } from "next/server";

async function getCurrentUserProgressRoute() {
  const progress = await getCurrentUserProgress();

  if (!progress) {
    return errors.unauthorized();
  }

  return NextResponse.json(serializeCurrentUserProgress(progress));
}

export const GET = withApiErrorBoundary(getCurrentUserProgressRoute);
