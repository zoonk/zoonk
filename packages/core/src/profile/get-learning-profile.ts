import "server-only";
import { cacheTag } from "next/cache";
import { getLearningProfileCacheTag } from "../cache/tags";
import { getSession } from "../users/get-session";
import { findLearningProfileView } from "./_utils/learning-profile-view";
import { type LearningProfileView } from "./learning-profile-contract";

/**
 * Reads the signed-in learner's (or guest's) buddy, age answer, settings and active goal. The apps
 * and the API read this same view.
 */
export async function getLearningProfile(): Promise<LearningProfileView | null> {
  "use cache: private";

  const session = await getSession();

  if (!session) {
    return null;
  }

  cacheTag(getLearningProfileCacheTag(session.user.id));

  return findLearningProfileView(session.user.id);
}
