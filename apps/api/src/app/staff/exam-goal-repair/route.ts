import { createErrorResponse, errors, httpStatus } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { readBody } from "@/lib/request-input";
import { STAFF_REPAIR_SCOPE } from "@zoonk/auth/cli-login-contract";
import { examChoicePickSchema } from "@zoonk/core/exams/choices/contract";
import { countryCodeSchema } from "@zoonk/core/goals/country-contract";
import { getStaffActor } from "@zoonk/core/staff/actor";
import { repairExamGoal } from "@zoonk/core/staff/repair-exam-goal";
import { logInfo } from "@zoonk/utils/logger";
import { uuidSchema } from "@zoonk/utils/uuid-schema";
import { NextResponse } from "next/server";
import { z } from "zod";

const target = { apply: z.boolean().default(false), goalId: uuidSchema() };

const inputSchema = z.union([
  z.strictObject({ ...target, country: countryCodeSchema }),
  z.strictObject({ ...target, choice: examChoicePickSchema }),
]);

async function repairGoal(request: Request) {
  const input = await readBody(request, inputSchema);
  const actor = await getStaffActor(input.apply ? STAFF_REPAIR_SCOPE : undefined);

  if (actor.status !== "ready") {
    const identified = "userId" in actor ? actor : null;

    logInfo(
      JSON.stringify({
        actorUserId: identified?.userId ?? null,
        clientId: identified?.clientId ?? null,
        event: "staff.exam-goal-repair",
        goalId: input.goalId,
        status: actor.status,
      }),
    );
  }

  if (actor.status === "missingScope" && input.apply) {
    return createErrorResponse({
      code: "REPAIR_SCOPE_REQUIRED",
      message: "Log in with pnpm zoonk login --repair to apply repairs.",
      status: httpStatus.forbidden,
    });
  }

  if (actor.status !== "ready") {
    return actor.status === "unauthorized" ? errors.unauthorized() : errors.forbidden();
  }

  const result = await repairExamGoal({
    actor,
    answer: "choice" in input ? { choice: input.choice } : { country: input.country },
    apply: input.apply,
    goalId: input.goalId,
  });

  if (result.status === "notFound") {
    return errors.notFound("No active exam goal with this id");
  }

  if (result.status === "invalid") {
    return errors.unprocessableEntity("This goal can't take this country or option");
  }

  if (result.status === "conflict") {
    return errors.conflict("The learner already gave another answer");
  }

  return NextResponse.json(result);
}

export const POST = withApiErrorBoundary(repairGoal);
