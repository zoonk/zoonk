import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { usageDecisionError } from "@/lib/lesson-player-errors";
import { goalSkillPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { readPathParams } from "@/lib/request-input";
import { courseOutlineWorkflow } from "@/workflows/v2/courses/course-outline-workflow";
import { requestSkillOutline } from "@zoonk/core/lookahead/skill-outline";
import { NextResponse } from "next/server";
import { start } from "workflow/api";

const ACCEPTED = 202;

function writing(generationId: string | null) {
  return NextResponse.json(
    { generationId, status: "writing" },
    {
      headers: generationId
        ? { Location: `/v1/generations/${encodeURIComponent(generationId)}` }
        : undefined,
      status: ACCEPTED,
    },
  );
}

async function createOutlineGeneration(
  _request: Request,
  context: RouteContext<"/v1/goals/[goalId]/skills/[skillId]/outline/generations">,
) {
  const path = await readPathParams(context, goalSkillPathParamsSchema);

  const result = await requestSkillOutline(path);

  if (result.status === "unauthorized") {
    return errors.unauthorized();
  }

  if (result.status === "notFound") {
    return errors.notFound();
  }

  if (result.status === "unavailable") {
    return errors.unprocessableEntity(
      "The plan has nothing left to write for this topic: it was studied, settled or left out",
    );
  }

  if (result.status === "refused") {
    return usageDecisionError(result.decision);
  }

  if (result.status === "ready") {
    return NextResponse.json({ generationId: null, status: "ready" });
  }

  if (result.status === "writing") {
    return writing(null);
  }

  const run = await start(courseOutlineWorkflow, [
    {
      ...result.need,
      analytics: result.analytics,
      forGuest: result.forGuest,
      waitedSkillId: path.skillId,
    },
  ]);

  return writing(run.runId);
}

export const POST = withApiErrorBoundary(createOutlineGeneration);
