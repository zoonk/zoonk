import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { parseBody } from "@/lib/body-parser";
import { learningDiscoveryResponse } from "@/lib/learning-discovery-responses";
import {
  discoveryPathParamsSchema,
  discoveryRevisionInputSchema,
} from "@/lib/openapi/schemas/learning-discovery";
import { parsePathParams } from "@/lib/path-params";
import {
  getCurrentUserCourseDiscovery,
  reviseCurrentUserCourseDiscovery,
} from "@zoonk/core/courses/discovery";
import { type NextRequest } from "next/server";

type Context = RouteContext<"/v1/me/course-discoveries/[discoveryId]">;

async function getDiscovery(_request: NextRequest, context: Context) {
  const path = parsePathParams({ params: await context.params, schema: discoveryPathParamsSchema });

  if (!path.success) {
    return errors.validation(path.error);
  }

  return learningDiscoveryResponse(await getCurrentUserCourseDiscovery(path.data));
}

async function reviseDiscovery(request: NextRequest, context: Context) {
  const path = parsePathParams({ params: await context.params, schema: discoveryPathParamsSchema });

  if (!path.success) {
    return errors.validation(path.error);
  }

  const body = await parseBody(request, discoveryRevisionInputSchema);

  if (!body.success) {
    return errors.validation(body.error);
  }

  return learningDiscoveryResponse(
    await reviseCurrentUserCourseDiscovery({ ...path.data, ...body.data }),
  );
}
export const GET = withApiErrorBoundary(getDiscovery);
export const PATCH = withApiErrorBoundary(reviseDiscovery);
