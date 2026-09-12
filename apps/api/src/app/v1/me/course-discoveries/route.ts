import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { parseBody } from "@/lib/body-parser";
import { learningDiscoveryResponse } from "@/lib/learning-discovery-responses";
import { learningRequestInputSchema } from "@/lib/openapi/schemas/learning-discovery";
import { createCurrentUserCourseDiscovery } from "@zoonk/core/courses/discovery";
import { type NextRequest } from "next/server";

async function createDiscovery(request: NextRequest) {
  const body = await parseBody(request, learningRequestInputSchema);

  if (!body.success) {
    return errors.validation(body.error);
  }

  return learningDiscoveryResponse(await createCurrentUserCourseDiscovery(body.data));
}
export const POST = withApiErrorBoundary(createDiscovery);
