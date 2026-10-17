import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { examError } from "@/lib/exam-errors";
import { startGoalWork } from "@/lib/goal-content";
import { goalPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { parsePathParams } from "@/lib/path-params";
import { moveLanguageGoalToExam } from "@zoonk/core/exams/language-goal";
import { NextResponse } from "next/server";

const CREATED = 201;

function refuseMove(status: "noExam" | "notFound" | "refused" | "unauthorized") {
  if (status === "noExam") {
    return examError({ status: "notExam" });
  }

  return status === "refused"
    ? errors.conflict("The exam goal couldn't be created")
    : examError({ status });
}

/**
 * "Pass an exam" inside a language goal: when its reason names a certificate, it moves to an
 * exam goal for it (research and the curriculum start), and the language goal is archived.
 */
async function postExamMove(
  _request: Request,
  context: RouteContext<"/v1/goals/[goalId]/exam-moves">,
) {
  const path = parsePathParams({ params: await context.params, schema: goalPathParamsSchema });

  if (!path.success) {
    return errors.validation(path.error);
  }

  const result = await moveLanguageGoalToExam(path.data.goalId);

  if (result.status !== "moved") {
    return refuseMove(result.status);
  }

  const { generations, research } = await startGoalWork([result.goal]);

  return NextResponse.json({ generations, goal: result.goal, research }, { status: CREATED });
}

export const POST = withApiErrorBoundary(postExamMove);
