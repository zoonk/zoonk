"use client";

import { checkIdentity } from "./learner-identity";

/**
 * What a learner's request answered (a Server Action's result, say), kept only while the page
 * still belongs to the learner the browser holds once it arrives: null when someone else's session
 * landed meanwhile, so nothing of the first learner's reaches a page that's about to be covered.
 */
export async function deliveredForThisLearner<Result>(
  pending: Promise<Result>,
): Promise<Result | null> {
  const result = await pending;
  return checkIdentity() ? result : null;
}
