import { listCurrentUserMistakes } from "@zoonk/core/mistakes/list-current-user";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

/** How many of a goal's mistakes are ready to practice: zero when it can't tell. */
export type ReadyMistakesResponse = { ready: number };

/**
 * The palette's "Practice your mistakes" count, read each time it opens: the same availability the
 * notebook counts, so it never opens an empty practice. A read, not a Server Action, so it never
 * waits in the browser's action queue ahead of what the learner picks (a goal switch), and the
 * palette can drop it when it closes.
 */
export async function GET(request: NextRequest): Promise<NextResponse<ReadyMistakesResponse>> {
  const goalId = z.uuid().safeParse(request.nextUrl.searchParams.get("goalId"));

  const result = goalId.success
    ? await listCurrentUserMistakes({ goalId: goalId.data, limit: 1, offset: 0, status: "open" })
    : null;

  const ready = result?.status === "ready" ? result.availability.ready : 0;

  return NextResponse.json({ ready }, { headers: { "Cache-Control": "private, no-store" } });
}
