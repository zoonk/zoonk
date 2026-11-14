import { createHash, timingSafeEqual } from "node:crypto";
import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { readBody } from "@/lib/request-input";
import { startOnce } from "@/workflows/_shared/run-token";
import { followUpsWorkflow, getFollowUpsToken } from "@/workflows/follow-ups/follow-ups-workflow";
import { getChapterMindMapToken } from "@/workflows/mind-maps/chapter-mind-map-input";
import { chapterMindMapWorkflow } from "@/workflows/mind-maps/chapter-mind-map-workflow";
import { FOLLOW_UP_SECRET_HEADER } from "@zoonk/core/follow-ups/contract";
import { uuidSchema } from "@zoonk/utils/uuid-schema";
import { NextResponse } from "next/server";
import { z } from "zod";

const ACCEPTED = 202;

const followUpsRequestSchema = z.union([
  z.object({ userId: uuidSchema() }),
  z.object({ chapterId: uuidSchema() }),
]);

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

  const input = await readBody(request, followUpsRequestSchema);

  const runId =
    "chapterId" in input
      ? await startOnce(
          chapterMindMapWorkflow,
          [{ chapterId: input.chapterId, redraw: true }],
          getChapterMindMapToken(input.chapterId),
        )
      : await startOnce(followUpsWorkflow, [input], getFollowUpsToken(input.userId));

  return NextResponse.json({ runId }, { status: ACCEPTED });
}

export const POST = withApiErrorBoundary(acceptFollowUps);
