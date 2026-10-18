import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { parseBody } from "@/lib/body-parser";
import { generationWaitInputSchema } from "@zoonk/core/lookahead/contract";
import { recordGenerationWait } from "@zoonk/core/lookahead/record-generation-wait";
import { type NextRequest } from "next/server";

const NO_CONTENT = 204;

/** Records how long the learner waited for content to be written (the Generation Waited event). */
async function createGenerationWait(request: NextRequest) {
  const body = await parseBody(request, generationWaitInputSchema);

  if (!body.success) {
    return errors.validation(body.error);
  }

  const result = await recordGenerationWait(body.data);

  if (result.status === "unauthorized") {
    return errors.unauthorized();
  }

  return new Response(null, { status: NO_CONTENT });
}

export const POST = withApiErrorBoundary(createGenerationWait);
