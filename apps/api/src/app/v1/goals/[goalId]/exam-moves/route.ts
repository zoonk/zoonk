import { withApiErrorBoundary } from "@/lib/api-handler";
import { examError } from "@/lib/exam-errors";
import { startGoalWork } from "@/lib/goal-content";
import { goalPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { readPathParams } from "@/lib/request-input";
import { moveLanguageGoalToExam } from "@zoonk/core/exams/language-goal";
import { NextResponse } from "next/server";

const CREATED = 201;

function refuseMove(status: "noExam" | "notFound" | "unauthorized") {
  return examError({ status: status === "noExam" ? "notExam" : status });
}

async function postExamMove(
  _request: Request,
  context: RouteContext<"/v1/goals/[goalId]/exam-moves">,
) {
  const path = await readPathParams(context, goalPathParamsSchema);

  const result = await moveLanguageGoalToExam(path.goalId);

  if (result.status !== "moved") {
    return refuseMove(result.status);
  }

  const { generations, research } = await startGoalWork([result.goal]);

  return NextResponse.json({ generations, goal: result.goal, research }, { status: CREATED });
}

export const POST = withApiErrorBoundary(postExamMove);
