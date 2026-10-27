import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { learnerAccessError } from "@/lib/learner-errors";
import { mistakeListQuerySchema } from "@/lib/openapi/schemas/mistakes";
import { createPaginatedResponse, decodeCursor } from "@/lib/pagination";
import { readQueryParams } from "@/lib/request-input";
import { listCurrentUserMistakes } from "@zoonk/core/mistakes/list-current-user";
import { NextResponse } from "next/server";

/** Returns one page of the learner's mistakes notebook with counts for the filters. */
async function listMistakes(request: Request) {
  const query = readQueryParams(request, mistakeListQuerySchema);

  const { cursor, ...filters } = query;
  const offset = cursor ? decodeCursor(cursor) : 0;

  if (offset === null) {
    return errors.badRequest("Invalid mistakes cursor");
  }

  const result = await listCurrentUserMistakes({ ...filters, offset });

  if (result.status !== "ready") {
    return learnerAccessError(result.status);
  }

  return NextResponse.json({
    availability: result.availability,
    counts: result.counts,
    ...createPaginatedResponse({ hasMore: result.hasMore, items: result.mistakes, offset }),
    trueFalseLabels: result.trueFalseLabels,
  });
}

export const GET = withApiErrorBoundary(listMistakes);
