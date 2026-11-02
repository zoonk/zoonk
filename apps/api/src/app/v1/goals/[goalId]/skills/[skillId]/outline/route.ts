import { withApiErrorBoundary } from "@/lib/api-handler";
import { learnerAccessError } from "@/lib/learner-errors";
import { goalSkillPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { readPathParams } from "@/lib/request-input";
import { getSkillOutline } from "@zoonk/core/lookahead/skill-outline";
import { NextResponse } from "next/server";

async function getOutline(
  _request: Request,
  context: RouteContext<"/v1/goals/[goalId]/skills/[skillId]/outline">,
) {
  const path = await readPathParams(context, goalSkillPathParamsSchema);

  const result = await getSkillOutline(path);

  if (result.status !== "ready") {
    return learnerAccessError(result.status === "unauthorized" ? "unauthorized" : "notFound");
  }

  return NextResponse.json(result.outline);
}

export const GET = withApiErrorBoundary(getOutline);
