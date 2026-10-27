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

/** A run is writing the topic's lesson plan: 202 with its id, and its status URL once it has one. */
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

/**
 * Writes a far topic's lesson plan when the learner asks to see it: `ready` when its chapters
 * exist; otherwise the outline of its course band, the chapter teaching the topic first, which
 * every later learner of the course shares. A request while its course is being outlined starts
 * nothing. A new one counts toward the learner's lesson plans.
 */
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
