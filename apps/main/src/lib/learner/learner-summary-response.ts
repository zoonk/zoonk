import { type LearnerSummary } from "@zoonk/core/learner/summary/contract";
import { type Snapshot } from "./learner-snapshot";

/**
 * What `GET /api/learner/summary` answers: the learner's summary, or that the browser holds no
 * session, with when the server read it (milliseconds), so an older answer never wins.
 */
export type LearnerSummaryResponse =
  | { readAt: number; status: "visitor" }
  | { status: "ready"; summary: LearnerSummary };

/** Where the browser reads the learner summary. */
const LEARNER_SUMMARY_PATH = "/api/learner/summary";

/** Reads the learner summary from main's route, as a snapshot of the server's. */
export async function fetchLearnerSummary(): Promise<Snapshot> {
  const response = await fetch(LEARNER_SUMMARY_PATH, {
    cache: "no-store",
    credentials: "same-origin",
    headers: { accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(`The learner summary read failed with ${response.status}`);
  }

  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Main's own route answers with this shape.
  const body = (await response.json()) as LearnerSummaryResponse;

  return body.status === "ready"
    ? { readAt: body.summary.readAt, source: "server", summary: body.summary }
    : { readAt: body.readAt, source: "server", summary: null };
}
