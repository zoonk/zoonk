import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { generationPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { readPathParams } from "@/lib/request-input";
import { readClientRun } from "@/workflows/_shared/run-activity";
import { WRITING_PROMPT_KIND } from "@zoonk/core/library/generation/steps";
import { NextResponse } from "next/server";
import { parseWorkflowName } from "workflow/observability";

const WRITING_UNITS = new Map<string, "answer" | "drill">([
  ["writingDrillWorkflow", "drill"],
  ["writingPromptWorkflow", "answer"],
]);

async function getGeneration(
  _request: Request,
  context: { params: Promise<{ generationId: string }> },
) {
  const path = await readPathParams(context, generationPathParamsSchema);

  const run = await readClientRun(path.generationId);

  if (run.outcome === "unknown") {
    return errors.serviceUnavailable();
  }

  if (run.outcome !== "found") {
    return errors.notFound("Generation not found");
  }

  const name = parseWorkflowName(run.workflowName)?.functionName;

  const unit = name ? WRITING_UNITS.get(name) : undefined;

  const kind = unit ? WRITING_PROMPT_KIND : undefined;

  return NextResponse.json({ id: path.generationId, kind, status: run.status, unit });
}

export const GET = withApiErrorBoundary(getGeneration);
