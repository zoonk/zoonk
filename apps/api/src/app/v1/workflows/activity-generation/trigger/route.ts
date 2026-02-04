import { errors } from "@/lib/api-errors";
import { parseBody } from "@/lib/body-parser";
import { activityGenerationTriggerSchema } from "@/lib/openapi/schemas/workflows";
import { activityGenerationWorkflow } from "@/workflows/activity-generation/activity-generation-workflow";
import { hasActiveSubscription } from "@zoonk/core/auth/subscription";
import { type NextRequest, NextResponse } from "next/server";
import { start } from "workflow/api";

export async function POST(request: NextRequest) {
  const parsed = await parseBody(request, activityGenerationTriggerSchema);

  if (!parsed.success) {
    return errors.validation(parsed.error);
  }

  const hasSubscription = await hasActiveSubscription(request.headers);

  if (!hasSubscription) {
    return errors.paymentRequired();
  }

  const run = await start(activityGenerationWorkflow, [BigInt(parsed.data.activityId)]);

  return NextResponse.json({
    message: "Workflow started",
    runId: run.runId,
  });
}
