import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { generationPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { readPathParams } from "@/lib/request-input";
import { readClientRunStatus } from "@/workflows/_shared/run-activity";
import { WRITING_PROMPT_KIND } from "@zoonk/core/library/generation/steps";
import { safeAsync } from "@zoonk/utils/error";
import { NextResponse } from "next/server";
import { getRun } from "workflow/api";
import { parseWorkflowName } from "workflow/observability";

async function getGeneration(
  _request: Request,
  context: { params: Promise<{ generationId: string }> },
) {
  const path = await readPathParams(context, generationPathParamsSchema);

  const status = await readClientRunStatus(path.generationId);

  if (!status) {
    return errors.notFound("Generation not found");
  }

  const { data: name } = await safeAsync(() => getRun(path.generationId).workflowName);

  const kind =
    name && parseWorkflowName(name)?.functionName === "writingPromptWorkflow"
      ? WRITING_PROMPT_KIND
      : undefined;

  return NextResponse.json({ id: path.generationId, kind, status });
}

export const GET = withApiErrorBoundary(getGeneration);
