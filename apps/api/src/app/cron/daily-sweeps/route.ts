import { timingSafeEqual } from "node:crypto";
import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { dailySweepsWorkflow } from "@/workflows/v2/sweeps/daily-sweeps-workflow";
import { NextResponse } from "next/server";
import { start } from "workflow/api";

const ACCEPTED = 202;

/** Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`; nothing else may start the sweeps. */
function isCronRequest(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  const header = request.headers.get("authorization") ?? "";

  if (!secret) {
    return false;
  }

  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(header);

  return expected.length === received.length && timingSafeEqual(expected, received);
}

/**
 * Vercel Cron's daily entry point. Internal, not part of the public API: it only starts the sweeps
 * workflow, which does the work durably.
 */
async function startDailySweeps(request: Request) {
  if (!isCronRequest(request)) {
    return errors.unauthorized();
  }

  const run = await start(dailySweepsWorkflow, []);

  return NextResponse.json({ runId: run.runId }, { status: ACCEPTED });
}

export const GET = withApiErrorBoundary(startDailySweeps);
