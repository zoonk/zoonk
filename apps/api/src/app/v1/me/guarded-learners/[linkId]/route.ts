import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { parseBody } from "@/lib/body-parser";
import { guardianLinkPathParamsSchema } from "@/lib/openapi/schemas/guardians";
import { parsePathParams } from "@/lib/path-params";
import {
  type GuardedLearnerUpdateInput,
  guardedLearnerUpdateSchema,
} from "@zoonk/core/minors/guardian/contract";
import { setGuardianDailyLimit } from "@zoonk/core/minors/guardian/set-daily-limit";
import { setGuardianMemory } from "@zoonk/core/minors/guardian/set-memory";
import { type NextRequest, NextResponse } from "next/server";

/** Applies each control the guardian sent; every one checks the same link. */
async function applyControls({
  dailyLimitMinutes,
  linkId,
  memoryOff,
}: GuardedLearnerUpdateInput & { linkId: string }) {
  const limit =
    dailyLimitMinutes === undefined
      ? null
      : await setGuardianDailyLimit({ dailyLimitMinutes, linkId });

  const memory = memoryOff === undefined ? null : await setGuardianMemory({ linkId, memoryOff });

  return [limit, memory].flatMap((result) => result ?? []);
}

/** The guardian sets or removes the learner's daily study limit, or turns their memory off or back. */
async function updateLearner(
  request: NextRequest,
  context: RouteContext<"/v1/me/guarded-learners/[linkId]">,
) {
  const [params, body] = await Promise.all([
    context.params,
    parseBody(request, guardedLearnerUpdateSchema),
  ]);

  const parsedParams = parsePathParams({ params, schema: guardianLinkPathParamsSchema });

  if (!parsedParams.success) {
    return errors.validation(parsedParams.error);
  }

  if (!body.success) {
    return errors.validation(body.error);
  }

  const results = await applyControls({ ...body.data, ...parsedParams.data });

  if (results.some((result) => result.status === "unauthorized")) {
    return errors.unauthorized();
  }

  if (results.some((result) => result.status === "notFound")) {
    return errors.notFound("Learner not found");
  }

  return new NextResponse(null, { status: 204 });
}

export const PATCH = withApiErrorBoundary(updateLearner);
