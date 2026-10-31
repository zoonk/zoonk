import { type LearnerSummary } from "@zoonk/core/learner/summary/contract";
import { type Snapshot } from "./learner-snapshot";

/** With when the server read it, so an older answer never wins. */
export type LearnerSummaryResponse =
  | { readAt: number; status: "visitor" }
  | { status: "ready"; summary: LearnerSummary };

const LEARNER_SUMMARY_PATH = "/api/learner/summary";

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
