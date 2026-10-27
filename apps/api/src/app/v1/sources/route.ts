import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { learnerSourcesQuerySchema } from "@/lib/openapi/schemas/research-sources";
import { readQueryParams } from "@/lib/request-input";
import { toSourceResource } from "@/lib/source-resources";
import { listLearnerSources } from "@zoonk/core/library/sources/list-learner";
import { type NextRequest, NextResponse } from "next/server";

/** The learner's own material: their uploads and what research found for their goals. */
async function getLearnerSources(request: NextRequest) {
  const parsed = readQueryParams(request, learnerSourcesQuerySchema);

  const links = await listLearnerSources({ goalId: parsed.goalId });

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
