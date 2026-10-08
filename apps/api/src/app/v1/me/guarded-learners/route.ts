import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { serializeGuardedLearner } from "@/lib/guardian-serializers";
import { listGuardedLearners } from "@zoonk/core/minors/guardian/list-guarded-learners";
import { NextResponse } from "next/server";

/** The learners who made the signed-in account their guardian, with their last seven days. */
async function listLearners() {
  const learners = await listGuardedLearners();

  if (!learners) {
    return errors.unauthorized();
  }

  return NextResponse.json({
    learners: learners.map((learner) => serializeGuardedLearner(learner)),
  });
}

export const GET = withApiErrorBoundary(listLearners);
