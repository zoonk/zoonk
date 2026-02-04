import { errors } from "@/lib/api-errors";
import { parseBody } from "@/lib/body-parser";
import { lessonGenerationTriggerSchema } from "@/lib/openapi/schemas/workflows";
import { lessonGenerationWorkflow } from "@/workflows/lesson-generation/lesson-generation-workflow";
import { hasActiveSubscription } from "@zoonk/core/auth/subscription";
import { type NextRequest, NextResponse } from "next/server";
import { start } from "workflow/api";

export async function POST(request: NextRequest) {
  const parsed = await parseBody(request, lessonGenerationTriggerSchema);

  if (!parsed.success) {
    return errors.validation(parsed.error);
  }

  const hasSubscription = await hasActiveSubscription(request.headers);

  if (!hasSubscription) {
    return errors.paymentRequired();
  }

  const run = await start(lessonGenerationWorkflow, [parsed.data.lessonId]);

  return NextResponse.json({
    message: "Workflow started",
    runId: run.runId,
  });
}
