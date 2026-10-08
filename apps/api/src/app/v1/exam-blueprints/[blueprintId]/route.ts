import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { examBlueprintPathParamsSchema } from "@/lib/openapi/schemas/research-sources";
import { parsePathParams } from "@/lib/path-params";
import { toExamBlueprintResource } from "@/lib/source-resources";
import { getExamBlueprint } from "@zoonk/core/library/exams/get";
import { NextResponse } from "next/server";

/** An exam's canonical blueprint for the exam map, plans and mocks. */
async function getExamBlueprintResource(
  _request: Request,
  context: RouteContext<"/v1/exam-blueprints/[blueprintId]">,
) {
  const parsed = parsePathParams({
    params: await context.params,
    schema: examBlueprintPathParamsSchema,
  });

  if (!parsed.success) {
    return errors.validation(parsed.error);
  }

  const blueprint = await getExamBlueprint({ blueprintId: parsed.data.blueprintId });

  if (!blueprint) {
    return errors.notFound("Exam blueprint not found");
  }

  return NextResponse.json(toExamBlueprintResource(blueprint));
}

export const GET = withApiErrorBoundary(getExamBlueprintResource);
