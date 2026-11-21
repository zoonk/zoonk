import { createErrorResponse, errors, httpStatus } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { startNoticeReadingAgain } from "@/lib/freshness";
import { readBody } from "@/lib/request-input";
import { STAFF_WRITING_REPAIR_SCOPE } from "@zoonk/auth/cli-login-contract";
import { getStaffActor } from "@zoonk/core/staff/actor";
import {
  listWrittenBlueprintRepairs,
  listWrittenGoalRepairs,
} from "@zoonk/core/staff/repair-written-preparation";
import { logInfo } from "@zoonk/utils/logger";
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
  const actor = await getStaffActor(input.apply ? STAFF_WRITING_REPAIR_SCOPE : undefined);

  if (actor.status !== "ready") {
    const identified = "userId" in actor ? actor : null;

    logInfo(
      JSON.stringify({
        actorUserId: identified?.userId ?? null,
        clientId: identified?.clientId ?? null,
        event: "staff.writing-repair",
        phase: input.phase,
        status: actor.status,
      }),
    );

    if (actor.status === "missingScope" && input.apply) {
      return createErrorResponse({
        code: "WRITING_REPAIR_SCOPE_REQUIRED",
        message: "Log in with pnpm zoonk login --repair-writing to apply writing repairs.",
        status: httpStatus.forbidden,
      });
    }

    return actor.status === "unauthorized" ? errors.unauthorized() : errors.forbidden();
  }

  if (input.phase === "learners") {
    const { entries, next } = await listWrittenGoalRepairs(
      input.apply
        ? { actor, after: input.after, apply: true }
        : { after: input.after, apply: false },
    );

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

        logInfo(
          JSON.stringify({
            actorUserId: actor.userId,
            blueprintId: entry.blueprintId,
            clientId: actor.clientId,
            event: "staff.writing-repair",
            runId,
            status: "reading",
          }),
        );

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
