import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { withApiImageUrls } from "@/lib/file-urls";
import { learnerAccessError } from "@/lib/learner-errors";
import { goalPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { parsePathParams } from "@/lib/path-params";
import { getSyllabusView } from "@zoonk/core/view-models/syllabus/get";
import { NextResponse } from "next/server";

/** Returns the structure of one of the learner's goals: its notice's subjects and topics, or its modules. */
async function getSyllabus(
  _request: Request,
  context: RouteContext<"/v1/goals/[goalId]/syllabus">,
) {
  const path = parsePathParams({ params: await context.params, schema: goalPathParamsSchema });

  if (!path.success) {
    return errors.validation(path.error);
  }

  const result = await getSyllabusView({ goalId: path.data.goalId });

  if (result.status !== "ready") {
    return learnerAccessError(result.status === "unauthorized" ? "unauthorized" : "notFound");
  }

  return NextResponse.json(withApiImageUrls(result.syllabus));
}

export const GET = withApiErrorBoundary(getSyllabus);
