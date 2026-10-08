import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { parseBody } from "@/lib/body-parser";
import { createResearchRequestSchema } from "@/lib/openapi/schemas/research-sources";
import { readClientRunStatus } from "@/workflows/v2/_shared/run-activity";
import { researchWorkflow } from "@/workflows/v2/research/research-workflow";
import { answerGoalUploadRequest } from "@zoonk/core/library/sources/upload-request";
import { type NextRequest, NextResponse } from "next/server";
import { start } from "workflow/api";

/**
 * A run that ended badly (a stalled one reads as failed) can be started again; any other is
 * followed instead of paid for twice. The new run stops a stalled one before it starts.
 */
const RESTARTABLE_STATUSES = new Set(["cancelled", "failed"]);

function researchResponse({ runId, status }: { runId: string; status: string }) {
  return NextResponse.json(
    { id: runId, result: null, status },
    { headers: { Location: `/v1/research/${runId}` }, status: 202 },
  );
}

/** The goal's last research run, unless it ended badly, stalled or no longer exists. */
async function findFollowableRun(runId: string | null) {
  if (!runId) {
    return null;
  }

  const status = await readClientRunStatus(runId);
  return !status || RESTARTABLE_STATUSES.has(status) ? null : { runId, status };
}

/**
 * Starts research for one of the learner's goals: the exam's blueprint, the
 * current law or documentation a goal depends on, or a big learn goal's
 * reference syllabi. Research runs once per goal: asking again returns the run
 * that researched it (running or done) and only a failed run starts over. With
 * `sourceIds`, it answers the goal's open upload request, once: the ask is
 * cleared at once, and the goal's curriculum is rebuilt from the upload once
 * research has read it.
 */
async function createResearch(request: NextRequest) {
  const parsed = await parseBody(request, createResearchRequestSchema);

  if (!parsed.success) {
    return errors.validation(parsed.error);
  }

  const access = await answerGoalUploadRequest(parsed.data);

  if (access.status === "unauthorized") {
    return errors.unauthorized();
  }

  if (access.status === "notFound") {
    return errors.notFound("Goal or source not found");
  }

  if (access.status === "noUploadRequest") {
    return errors.conflict("This goal has no upload request to answer");
  }

  const followed =
    access.sourceIds.length === 0 ? await findFollowableRun(access.researchRunId) : null;

  if (followed) {
    return researchResponse(followed);
  }

  const run = await start(researchWorkflow, [
    { goalId: access.goalId, sourceIds: access.sourceIds },
  ]);

  return researchResponse({ runId: run.runId, status: await run.status });
}

export const POST = withApiErrorBoundary(createResearch);
