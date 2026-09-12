import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { parseBody } from "@/lib/body-parser";
import { learningDiscoveryResponse } from "@/lib/learning-discovery-responses";
import {
  discoveryPathParamsSchema,
  startDiscoveryBodySchema,
} from "@/lib/openapi/schemas/learning-discovery";
import { parsePathParams } from "@/lib/path-params";
import { startCurrentUserCourseDiscovery } from "@zoonk/core/courses/discovery";
import { type NextRequest } from "next/server";

async function mutate(
  request: NextRequest,
  context: RouteContext<"/v1/me/course-discoveries/[discoveryId]/start">,
) {
  const path = parsePathParams({ params: await context.params, schema: discoveryPathParamsSchema });

  if (!path.success) {
    return errors.validation(path.error);
  }

  const body = await parseBody(request, startDiscoveryBodySchema);

  if (!body.success) {
    return errors.validation(body.error);
  }

  return learningDiscoveryResponse(
    await startCurrentUserCourseDiscovery({ ...path.data, ...body.data }),
  );
}
export const POST = withApiErrorBoundary(mutate);
