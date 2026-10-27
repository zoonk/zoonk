import { withApiErrorBoundary } from "@/lib/api-handler";
import { learnerAccessError } from "@/lib/learner-errors";
import { readQueryParams } from "@/lib/request-input";
import { skillListInputSchema } from "@zoonk/core/learner/contract";
import { listCurrentUserSkills } from "@zoonk/core/learner/list-current-user-skills";
import { NextResponse } from "next/server";

/** Returns the learner's skills as study cards, for one goal or all of them. */
async function listSkills(request: Request) {
  const query = readQueryParams(request, skillListInputSchema);

  const result = await listCurrentUserSkills(query);

  if (result.status !== "ready") {
    return learnerAccessError(result.status);
  }

  return NextResponse.json({ counts: result.counts, skills: result.skills });
}

export const GET = withApiErrorBoundary(listSkills);
