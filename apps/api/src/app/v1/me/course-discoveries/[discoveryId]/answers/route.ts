import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { parseBody } from "@/lib/body-parser";
import { learningDiscoveryResponse } from "@/lib/learning-discovery-responses";
import {
  discoveryAnswerInputSchema,
  discoveryPathParamsSchema,
} from "@/lib/openapi/schemas/learning-discovery";
import { parsePathParams } from "@/lib/path-params";
import { answerCurrentUserCourseDiscovery } from "@zoonk/core/courses/discovery";
import { type NextRequest } from "next/server";

async function mutate(
  request: NextRequest,
  context: RouteContext<"/v1/me/course-discoveries/[discoveryId]/answers">,
) {
  const path = parsePathParams({ params: await context.params, schema: discoveryPathParamsSchema });

  if (!path.success) {
    return errors.validation(path.error);
  }

  const body = await parseBody(request, discoveryAnswerInputSchema);

  if (!body.success) {
    return errors.validation(body.error);
  }

  return learningDiscoveryResponse(
    await answerCurrentUserCourseDiscovery({ ...path.data, ...body.data }),
  );
}
export const POST = withApiErrorBoundary(mutate);
