import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { generationPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { readPathParams } from "@/lib/request-input";
import { readClientRun } from "@/workflows/_shared/run-activity";
import { WRITING_PROMPT_KIND } from "@zoonk/core/library/generation/steps";
import { NextResponse } from "next/server";
import { parseWorkflowName } from "workflow/observability";

async function getGeneration(
  _request: Request,
  context: { params: Promise<{ generationId: string }> },
) {
  const path = await readPathParams(context, generationPathParamsSchema);

  const run = await readClientRun(path.generationId);

  if (!run) {
    return errors.notFound("Generation not found");
  }

  const name = parseWorkflowName(run.workflowName)?.functionName;

  const kind =
    name === "writingPromptWorkflow" || name === "writingBatchWorkflow"
      ? WRITING_PROMPT_KIND
      : undefined;

  return NextResponse.json({ id: path.generationId, kind, status: run.status });
}

export const GET = withApiErrorBoundary(getGeneration);
