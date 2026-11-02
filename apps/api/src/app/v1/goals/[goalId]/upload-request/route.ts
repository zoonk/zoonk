import { accessError } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { goalPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { readPathParams } from "@/lib/request-input";
import {
  dismissGoalUploadRequest,
  getGoalUploadRequest,
} from "@zoonk/core/library/sources/upload-request";
import { NextResponse } from "next/server";

type Context = RouteContext<"/v1/goals/[goalId]/upload-request">;

async function getUploadRequest(_request: Request, context: Context) {
  const path = await readPathParams(context, goalPathParamsSchema);

  const result = await getGoalUploadRequest({ goalId: path.goalId });

  if (result.status !== "ready") {
    return accessError(result.status, "Goal not found");
  }

  return NextResponse.json({ request: result.request });
}

async function dismissUploadRequest(_request: Request, context: Context) {
  const path = await readPathParams(context, goalPathParamsSchema);

  const result = await dismissGoalUploadRequest({ goalId: path.goalId });

  if (result.status !== "dismissed") {
    return accessError(result.status, "Goal not found");
  }

  return new NextResponse(null, { status: 204 });
}

export const GET = withApiErrorBoundary(getUploadRequest);
export const DELETE = withApiErrorBoundary(dismissUploadRequest);
