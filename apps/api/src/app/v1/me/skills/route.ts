import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { learnerAccessError } from "@/lib/learner-errors";
import { parseQueryParams } from "@/lib/query-params";
import { skillListInputSchema } from "@zoonk/core/learner/contract";
import { listCurrentUserSkills } from "@zoonk/core/learner/list-current-user-skills";
import { NextResponse } from "next/server";

/** Returns the learner's skills as study cards, for one goal or all of them. */
async function listSkills(request: Request) {
  const query = parseQueryParams(new URL(request.url).searchParams, skillListInputSchema);

  if (!query.success) {
    return errors.validation(query.error);
  }

  const result = await listCurrentUserSkills(query.data);

  if (result.status !== "ready") {
    return learnerAccessError(result.status);
  }

  return NextResponse.json({ counts: result.counts, skills: result.skills });
}

export const GET = withApiErrorBoundary(listSkills);
