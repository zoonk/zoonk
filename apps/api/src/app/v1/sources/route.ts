import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { learnerSourcesQuerySchema } from "@/lib/openapi/schemas/research-sources";
import { parseQueryParams } from "@/lib/query-params";
import { toSourceResource } from "@/lib/source-resources";
import { listLearnerSources } from "@zoonk/core/library/sources/list-learner";
import { type NextRequest, NextResponse } from "next/server";

/** The learner's own material: their uploads and what research found for their goals. */
async function getLearnerSources(request: NextRequest) {
  const parsed = parseQueryParams(request.nextUrl.searchParams, learnerSourcesQuerySchema);

  if (!parsed.success) {
    return errors.validation(parsed.error);
  }

  const links = await listLearnerSources({ goalId: parsed.data.goalId });

  if (!links) {
    return errors.unauthorized();
  }

  return NextResponse.json({
    sources: links.map((link) => ({
      addedAt: link.createdAt.toISOString(),
      goalId: link.goalId,
      origin: link.origin,
      source: toSourceResource(link.source),
    })),
  });
}

export const GET = withApiErrorBoundary(getLearnerSources);
