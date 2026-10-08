import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { parseBody } from "@/lib/body-parser";
import { freshnessCommandRequestSchema } from "@/lib/openapi/schemas/research-sources";
import { freshnessWorkflow } from "@/workflows/v2/freshness/freshness-workflow";
import { getFreshnessCommandAccess } from "@zoonk/core/library/exams/freshness-access";
import { stopFreshnessChecks } from "@zoonk/core/library/exams/freshness-checks";
import { type NextRequest, NextResponse } from "next/server";
import { start } from "workflow/api";

/**
 * Lets an admin check an exam or source now, or stop its checks until a learner's goal needs
 * them again.
 */
async function sendFreshnessCommand(request: NextRequest) {
  const parsed = await parseBody(request, freshnessCommandRequestSchema);

  if (!parsed.success) {
    return errors.validation(parsed.error);
  }

  const { command, target } = parsed.data;

  const access =
    command === "stop"
      ? await stopFreshnessChecks(target)
      : await getFreshnessCommandAccess(target);

  if (access === "unauthorized") {
    return errors.unauthorized();
  }

  if (access === "forbidden") {
    return errors.forbidden();
  }

  if (access === "notFound") {
    return errors.notFound("Exam or source not found");
  }

  if (command === "stop") {
    return NextResponse.json({ status: "stopped" });
  }

  await start(freshnessWorkflow, [target]);

  return NextResponse.json({ status: "started" });
}

export const POST = withApiErrorBoundary(sendFreshnessCommand);
