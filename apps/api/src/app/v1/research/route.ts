import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { createResearchRequestSchema } from "@/lib/openapi/schemas/research-sources";
import { readBody } from "@/lib/request-input";
import { readClientRunStatus } from "@/workflows/v2/_shared/run-activity";
import { researchWorkflow } from "@/workflows/v2/research/research-workflow";
import { answerGoalUploadRequest } from "@zoonk/core/library/sources/upload-request";
import { type NextRequest, NextResponse } from "next/server";
import { start } from "workflow/api";

const RESTARTABLE_STATUSES = new Set(["cancelled", "failed"]);

function researchResponse({ runId, status }: { runId: string; status: string }) {
  return NextResponse.json(
    { id: runId, result: null, status },
    { headers: { Location: `/v1/research/${runId}` }, status: 202 },
  );
}

async function findFollowableRun(runId: string | null) {
  if (!runId) {
    return null;
  }

  const status = await readClientRunStatus(runId);
  return !status || RESTARTABLE_STATUSES.has(status) ? null : { runId, status };
}

async function createResearch(request: NextRequest) {
  const parsed = await readBody(request, createResearchRequestSchema);

  const access = await answerGoalUploadRequest(parsed);

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
