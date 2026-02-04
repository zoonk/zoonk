import { errors } from "@/lib/api-errors";
import { parseBody } from "@/lib/body-parser";
import { activityGenerationTriggerSchema } from "@/lib/openapi/schemas/workflows";
import { activityGenerationWorkflow } from "@/workflows/activity-generation/activity-generation-workflow";
import { auth } from "@zoonk/core/auth";
import { findActiveSubscription } from "@zoonk/core/auth/subscription";
import { type NextRequest, NextResponse } from "next/server";
import { start } from "workflow/api";

async function getSubscriptions(request: NextRequest) {
  try {
    return await auth.api.listActiveSubscriptions({
      headers: request.headers,
    });
  } catch {
    return [];
  }
}

export async function POST(request: NextRequest) {
  const parsed = await parseBody(request, activityGenerationTriggerSchema);

  if (!parsed.success) {
    return errors.validation(parsed.error);
  }

  const subscriptions = await getSubscriptions(request);

  if (!findActiveSubscription(subscriptions)) {
    return errors.paymentRequired();
  }

  const run = await start(activityGenerationWorkflow, [BigInt(parsed.data.activityId)]);

  return NextResponse.json({
    message: "Workflow started",
    runId: run.runId,
  });
}
