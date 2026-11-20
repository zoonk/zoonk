import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { startNoticeReadingAgain } from "@/lib/freshness";
import { readBody } from "@/lib/request-input";
import { STAFF_PROPOSE_SCOPE } from "@zoonk/auth/cli-login-contract";
import { getStaffActor } from "@zoonk/core/staff/actor";
import {
  listWrittenBlueprintRepairs,
  listWrittenGoalRepairs,
} from "@zoonk/core/staff/repair-written-preparation";
import { uuidSchema } from "@zoonk/utils/uuid-schema";
import { NextResponse } from "next/server";
import { z } from "zod";

const inputSchema = z.strictObject({
  after: uuidSchema().optional(),
  apply: z.boolean().default(false),
  phase: z.enum(["blueprints", "learners"]),
});

async function repairWriting(request: Request) {
  const input = await readBody(request, inputSchema);
  const actor = await getStaffActor(input.apply ? STAFF_PROPOSE_SCOPE : undefined);

  if (actor.status !== "ready") {
    return actor.status === "unauthorized" ? errors.unauthorized() : errors.forbidden();
  }

  if (input.phase === "learners") {
    const { entries, next } = await listWrittenGoalRepairs(input);

    return NextResponse.json({
      eligible: entries.filter(({ status }) => status === "eligible" || status === "reopened")
        .length,
      entries,
      failed: entries.filter(({ status }) => status === "failed").length,
      next,
      reopened: entries.filter(({ status }) => status === "reopened").length,
      unchanged: entries.filter(({ status }) => status === "unchanged").length,
    });
  }

  const { entries, next } = await listWrittenBlueprintRepairs(input);

  const results = await Promise.all(
    entries.map(async (entry) => {
      if (!input.apply || entry.status !== "needsReading") {
        return entry;
      }

      try {
        const runId = await startNoticeReadingAgain(entry.blueprintId);
        return { ...entry, runId, status: "reading" };
      } catch {
        return { ...entry, status: "failed" };
      }
    }),
  );

  return NextResponse.json({
    eligible: entries.filter(({ status }) => status === "needsReading").length,
    entries: results,
    failed: results.filter(({ status }) => status === "failed").length,
    next,
  });
}

export const POST = withApiErrorBoundary(repairWriting);
