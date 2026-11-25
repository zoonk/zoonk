import { createErrorResponse, errors, httpStatus } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { createResearchRequestSchema } from "@/lib/openapi/schemas/research-sources";
import { readBody } from "@/lib/request-input";
import { startResearch } from "@/lib/research";
import { readClientRunStatus } from "@/workflows/_shared/run-activity";
import { startResearchUploadAnswer } from "@/workflows/research/answer-research-upload-workflow";
import { answerGoalUploadRequest } from "@zoonk/core/library/sources/upload-request";
import { type NextRequest, NextResponse } from "next/server";
import { getRun } from "workflow/api";

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

  if (access.status === "alreadyAnswered") {
    return createErrorResponse({
      code: "UPLOAD_ALREADY_READ",
      message: "Research already read these uploads; add a different document",
      status: httpStatus.conflict,
    });
  }

  if (access.status === "unreadable") {
    return createErrorResponse({
      code: "UPLOAD_UNREADABLE",
      message: "None of the uploads have readable text",
      status: httpStatus.unprocessableEntity,
    });
  }

  const followed =
    access.sourceIds.length === 0 ? await findFollowableRun(access.researchRunId) : null;

  if (followed) {
    return researchResponse(followed);
  }

  const runId = access.pendingUploadAnswer
    ? await startResearchUploadAnswer(access.pendingUploadAnswer)
    : await startResearch({ goalId: access.goalId, sourceIds: access.sourceIds });

  return researchResponse({ runId, status: await getRun(runId).status });
}

export const POST = withApiErrorBoundary(createResearch);
