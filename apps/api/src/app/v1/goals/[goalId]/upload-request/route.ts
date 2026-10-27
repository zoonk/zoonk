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

/**
 * What research is waiting for on one of the learner's goals: the official notice or source it
 * couldn't find, or the class's material for a teacher's test. `request` is null when research
 * needs nothing. Answer it with `POST /v1/research` and the uploaded `sourceIds`.
 */
async function getUploadRequest(_request: Request, context: Context) {
  const path = await readPathParams(context, goalPathParamsSchema);

  const result = await getGoalUploadRequest({ goalId: path.goalId });

  if (result.status !== "ready") {
    return accessError(result.status, "Goal not found");
  }

  return NextResponse.json({ request: result.request });
}

/** The learner doesn't have the document: the ask leaves Plan and Today. */
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
