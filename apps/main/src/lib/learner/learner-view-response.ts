import { type LearnerViewKind, type LearnerViewResponse } from "./learner-view-copies";
import { parseLearnerView } from "./view-json";

/** Reads one of the learner's views from main's route (`GET /api/learner/views/{kind}`). */
export async function fetchLearnerView(
  kind: LearnerViewKind,
): Promise<LearnerViewResponse<unknown>> {
  const response = await fetch(`/api/learner/views/${kind}`, {
    cache: "no-store",
    credentials: "same-origin",
    headers: { accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(`The ${kind} view read failed with ${response.status}`);
  }

  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Main's own route answers with this shape.
  return parseLearnerView(await response.text()) as LearnerViewResponse<unknown>;
}
