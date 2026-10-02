import "server-only";
import { cacheTag } from "next/cache";
import { getLearningProfileCacheTag } from "../cache/tags";
import { getSession } from "../users/get-session";
import { findLearningProfileView } from "./_utils/learning-profile-view";
import { type LearningProfileView } from "./learning-profile-contract";

/**
 * Reads the signed-in learner's (or guest's) mode, buddy, age answer and active goal. Both modes and
 * the API read this same view; nothing about a mode is computed elsewhere.
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
