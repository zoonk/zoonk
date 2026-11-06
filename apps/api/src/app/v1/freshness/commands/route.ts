import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { startFreshnessCheck, startNoticeReadingAgain } from "@/lib/freshness";
import { freshnessCommandRequestSchema } from "@/lib/openapi/schemas/research-sources";
import { readBody } from "@/lib/request-input";
import { getFreshnessCommandAccess } from "@zoonk/core/library/exams/freshness-access";
import { stopFreshnessChecks } from "@zoonk/core/library/exams/freshness-checks";
import { type NextRequest, NextResponse } from "next/server";

async function sendFreshnessCommand(request: NextRequest) {
  const parsed = await readBody(request, freshnessCommandRequestSchema);

  const { command, target } = parsed;

  if (command === "readAgain" && target.kind !== "exam") {
    return errors.badRequest("Only an exam's notice can be read again");
  }

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

  await (target.kind === "exam" && command === "readAgain"
    ? startNoticeReadingAgain(target.examBlueprintId)
    : startFreshnessCheck(target));

  return NextResponse.json({ status: "started" });
}

export const POST = withApiErrorBoundary(sendFreshnessCommand);
