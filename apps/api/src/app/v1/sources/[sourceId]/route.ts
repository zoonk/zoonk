import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { sourcePathParamsSchema } from "@/lib/openapi/schemas/research-sources";
import { parsePathParams } from "@/lib/path-params";
import { toSourceResource } from "@/lib/source-resources";
import { getSource } from "@zoonk/core/library/sources/get";
import { NextResponse } from "next/server";

/** One source for a citation: public ones for anyone, private uploads for their owner only. */
async function getSourceResource(
  _request: Request,
  context: RouteContext<"/v1/sources/[sourceId]">,
) {
  const parsed = parsePathParams({ params: await context.params, schema: sourcePathParamsSchema });

  if (!parsed.success) {
    return errors.validation(parsed.error);
  }

  const source = await getSource({ sourceId: parsed.data.sourceId });

  if (!source) {
    return errors.notFound("Source not found");
  }

  return NextResponse.json(toSourceResource(source));
}

export const GET = withApiErrorBoundary(getSourceResource);
