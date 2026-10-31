import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { sourcePathParamsSchema } from "@/lib/openapi/schemas/research-sources";
import { readPathParams } from "@/lib/request-input";
import { toSourceResource } from "@/lib/source-resources";
import { getSource } from "@zoonk/core/library/sources/get";
import { NextResponse } from "next/server";

async function getSourceResource(
  _request: Request,
  context: RouteContext<"/v1/sources/[sourceId]">,
) {
  const parsed = await readPathParams(context, sourcePathParamsSchema);

  const source = await getSource({ sourceId: parsed.sourceId });

  if (!source) {
    return errors.notFound("Source not found");
  }

  return NextResponse.json(toSourceResource(source));
}

export const GET = withApiErrorBoundary(getSourceResource);
