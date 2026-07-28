import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { coursePromptPathParamsSchema } from "@/lib/openapi/schemas/course-prompts";
import { parsePathParams } from "@/lib/path-params";
import { getCoursePromptGenerationResource } from "@zoonk/core/courses/get-prompt-generation";
import { NextResponse } from "next/server";

/**
 * Returns the durable generation state and an ID-based target once the prompt's
 * course is useful.
 */
async function getCoursePrompt(
  _request: Request,
  context: RouteContext<"/v1/course-prompts/[coursePromptId]">,
) {
  const parsed = parsePathParams({
    params: await context.params,
    schema: coursePromptPathParamsSchema,
  });

  if (!parsed.success) {
    return errors.validation(parsed.error);
  }

  const resource = await getCoursePromptGenerationResource({
    coursePromptId: parsed.data.coursePromptId,
  });

  if (resource.status === "notFound") {
    return errors.notFound();
  }

  return NextResponse.json(resource);
}

export const GET = withApiErrorBoundary(getCoursePrompt);
