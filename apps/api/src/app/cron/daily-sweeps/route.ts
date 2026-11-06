import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { dailySweepsWorkflow } from "@/workflows/sweeps/daily-sweeps-workflow";
import { NextResponse } from "next/server";
import { start } from "workflow/api";

const ACCEPTED = 202;

/** Only Vercel's scheduler can call this: its schedule trigger in `vercel.json` gives it no public URL. */
async function startDailySweeps(request: Request) {
  const executionId = request.headers.get("ce-id");

  if (!executionId) {
    return errors.badRequest("Not a scheduled run");
  }

  const run = await start(dailySweepsWorkflow, [{ executionId }]);

  return NextResponse.json({ runId: run.runId }, { status: ACCEPTED });
}

export const POST = withApiErrorBoundary(startDailySweeps);
