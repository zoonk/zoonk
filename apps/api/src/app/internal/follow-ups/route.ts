import { createHash, timingSafeEqual } from "node:crypto";
import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { readBody } from "@/lib/request-input";
import { followUpsWorkflow } from "@/workflows/follow-ups/follow-ups-workflow";
import { FOLLOW_UP_SECRET_HEADER } from "@zoonk/core/follow-ups/contract";
import { NextResponse } from "next/server";
import { start } from "workflow/api";
import { z } from "zod";

const ACCEPTED = 202;

const followUpsRequestSchema = z.object({ userId: z.uuid() });

/** Fixed-size digests keep the comparison constant-time even when the lengths differ. */
function hasFollowUpSecret(request: Request): boolean {
  const expected = process.env.APP_FOLLOW_UP_SECRET;
  const supplied = request.headers.get(FOLLOW_UP_SECRET_HEADER);

  if (!expected || !supplied) {
    return false;
  }

  return timingSafeEqual(
    createHash("sha256").update(expected).digest(),
    createHash("sha256").update(supplied).digest(),
  );
}

/** Core asks this after a learner's write owed work; the run reads the work from the database. */
async function acceptFollowUps(request: Request) {
  if (!hasFollowUpSecret(request)) {
    return errors.unauthorized();
  }

  const { userId } = await readBody(request, followUpsRequestSchema);
  const run = await start(followUpsWorkflow, [{ userId }]);

  return NextResponse.json({ runId: run.runId }, { status: ACCEPTED });
}

export const POST = withApiErrorBoundary(acceptFollowUps);
