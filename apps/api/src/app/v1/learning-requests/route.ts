import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { parseBody } from "@/lib/body-parser";
import { learningRequestResponse } from "@/lib/learning-discovery-responses";
import { learningRequestInputSchema } from "@/lib/openapi/schemas/learning-discovery";
import { resolveLearningRequest } from "@zoonk/core/courses/learning-request";
import { type NextRequest } from "next/server";

async function resolveRequest(request: NextRequest) {
  const body = await parseBody(request, learningRequestInputSchema);

  if (!body.success) {
    return errors.validation(body.error);
  }

  return learningRequestResponse(await resolveLearningRequest(body.data));
}
export const POST = withApiErrorBoundary(resolveRequest);
