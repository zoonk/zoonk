import { withApiErrorBoundary } from "@/lib/api-handler";
import { learnerAccessError } from "@/lib/learner-errors";
import { goalPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { readBody, readPathParams } from "@/lib/request-input";
import { saveMindMapSchema } from "@zoonk/core/mind-maps/contract";
import { saveMindMap } from "@zoonk/core/mind-maps/save";
import { NextResponse } from "next/server";

async function setSavedMindMap(
  request: Request,
  context: RouteContext<"/v1/goals/[goalId]/mind-maps/saved">,
) {
  const [path, body] = await Promise.all([
    readPathParams(context, goalPathParamsSchema),
    readBody(request, saveMindMapSchema),
  ]);

  const result = await saveMindMap({ ...body, goalId: path.goalId });

  if (result.status !== "ready") {
    return learnerAccessError(result.status);
  }

  return NextResponse.json({ kind: body.kind, saved: result.saved, targetId: body.targetId });
}

export const POST = withApiErrorBoundary(setSavedMindMap);
