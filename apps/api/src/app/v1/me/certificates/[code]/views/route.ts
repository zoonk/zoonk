import { accessError } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { certificatePathParamsSchema } from "@/lib/openapi/schemas/paths";
import { readPathParams } from "@/lib/request-input";
import { markCertificateShown } from "@zoonk/core/certificates/mark-shown";

async function createView(
  _request: Request,
  context: RouteContext<"/v1/me/certificates/[code]/views">,
) {
  const path = await readPathParams(context, certificatePathParamsSchema);
  const result = await markCertificateShown(path.code);

  if (result.status !== "ready") {
    return accessError(result.status);
  }

  return new Response(null, { status: 204 });
}

export const POST = withApiErrorBoundary(createView);
