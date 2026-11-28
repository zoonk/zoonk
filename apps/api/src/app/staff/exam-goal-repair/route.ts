import { createErrorResponse, errors, httpStatus } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { readBody } from "@/lib/request-input";
import { STAFF_REPAIR_SCOPE } from "@zoonk/auth/cli-login-contract";
import { examChoicePickSchema } from "@zoonk/core/exams/choices/contract";
import { countryCodeSchema } from "@zoonk/core/goals/country-contract";
import { getStaffActor } from "@zoonk/core/staff/actor";
import { repairExamGoal } from "@zoonk/core/staff/repair-exam-goal";
import { uuidSchema } from "@zoonk/utils/uuid-schema";
import { NextResponse } from "next/server";
import { z } from "zod";

const inputSchema = z.strictObject({
  apply: z.boolean().default(false),
  choices: z.array(examChoicePickSchema).min(1).optional(),
  country: countryCodeSchema.optional(),
  goalId: uuidSchema(),
});

async function repairGoal(request: Request) {
  const input = await readBody(request, inputSchema);
  const actor = await getStaffActor(input.apply ? STAFF_REPAIR_SCOPE : undefined);

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

  if (!input.country && !input.choices) {
    return errors.badRequest("Give a country or a choice to save");
  }

  const result = await repairExamGoal({ ...input, actor });

  if (result.status === "notFound") {
    return errors.notFound("No active exam goal with this id");
  }

  if (result.status === "invalid") {
    return errors.unprocessableEntity("The exam doesn't offer this country or option");
  }

  return NextResponse.json(result);
}

export const POST = withApiErrorBoundary(repairGoal);
