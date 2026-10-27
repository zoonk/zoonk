import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { readBody } from "@/lib/request-input";
import { generationWaitInputSchema } from "@zoonk/core/lookahead/contract";
import { recordGenerationWait } from "@zoonk/core/lookahead/record-generation-wait";
import { type NextRequest } from "next/server";

const NO_CONTENT = 204;

/** Records how long the learner waited for content to be written (the Generation Waited event). */
async function createGenerationWait(request: NextRequest) {
  const body = await readBody(request, generationWaitInputSchema);

  const result = await recordGenerationWait(body);

  if (result.status === "unauthorized") {
    return errors.unauthorized();
  }

  return new Response(null, { status: NO_CONTENT });
}

export const POST = withApiErrorBoundary(createGenerationWait);
