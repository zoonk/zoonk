import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { parseBody } from "@/lib/body-parser";
import { learningDiscoveryResponse } from "@/lib/learning-discovery-responses";
import {
  discoveryPathParamsSchema,
  emptyDiscoveryBodySchema,
} from "@/lib/openapi/schemas/learning-discovery";
import { parsePathParams } from "@/lib/path-params";
import { retryCurrentUserCourseDiscovery } from "@zoonk/core/courses/discovery";
import { type NextRequest } from "next/server";

async function mutate(
  request: NextRequest,
  context: RouteContext<"/v1/me/course-discoveries/[discoveryId]/retry">,
) {
  const path = parsePathParams({ params: await context.params, schema: discoveryPathParamsSchema });

  if (!path.success) {
    return errors.validation(path.error);
  }

  const body = await parseBody(request, emptyDiscoveryBodySchema);

  if (!body.success) {
    return errors.validation(body.error);
  }

  return learningDiscoveryResponse(
    await retryCurrentUserCourseDiscovery({ ...path.data, ...body.data }),
  );
}
export const POST = withApiErrorBoundary(mutate);
