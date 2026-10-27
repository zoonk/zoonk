import { withApiErrorBoundary } from "@/lib/api-handler";
import { withApiImageUrls } from "@/lib/file-urls";
import { learnerAccessError } from "@/lib/learner-errors";
import { goalPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { readPathParams } from "@/lib/request-input";
import { getSyllabusView } from "@zoonk/core/view-models/syllabus/get";
import { NextResponse } from "next/server";

/** Returns the structure of one of the learner's goals: its notice's subjects and topics, or its modules. */
async function getSyllabus(
  _request: Request,
  context: RouteContext<"/v1/goals/[goalId]/syllabus">,
) {
  const path = await readPathParams(context, goalPathParamsSchema);

  const result = await getSyllabusView({ goalId: path.goalId });

  if (result.status !== "ready") {
    return learnerAccessError(result.status === "unauthorized" ? "unauthorized" : "notFound");
  }

  return NextResponse.json(withApiImageUrls(result.syllabus));
}

export const GET = withApiErrorBoundary(getSyllabus);
