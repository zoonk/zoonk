import { errors } from "@/lib/api-errors";
import { parseBody } from "@/lib/body-parser";
import { lessonPreloadTriggerSchema } from "@/lib/openapi/schemas/workflows";
import { lessonPreloadWorkflow } from "@/workflows/lesson-preload/lesson-preload-workflow";
import { hasActiveSubscription } from "@zoonk/core/auth/subscription";
import { type NextRequest, NextResponse } from "next/server";
import { start } from "workflow/api";

export async function POST(request: NextRequest) {
  const parsed = await parseBody(request, lessonPreloadTriggerSchema);

  if (!parsed.success) {
    return errors.validation(parsed.error);
  }

  const hasSubscription = await hasActiveSubscription(request.headers);

  if (!hasSubscription) {
    return errors.paymentRequired();
  }

  const run = await start(lessonPreloadWorkflow, [parsed.data.lessonId]);

  return NextResponse.json({
    message: "Workflow started",
    runId: run.runId,
  });
}
