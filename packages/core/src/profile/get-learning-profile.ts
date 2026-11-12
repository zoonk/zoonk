import "server-only";
import { cacheTag } from "next/cache";
import { getGoalsCacheTag, getLearningProfileCacheTag } from "../cache/tags";
import { readLearningProfile } from "../learner/facts/learning-profile";
import { readRecentCountries } from "../learner/facts/recent-countries";
import { getSession } from "../users/get-session";
import { findLearningProfileView } from "./_utils/learning-profile-view";
import { type LearningProfileView } from "./learning-profile-contract";

/** Returns null without a learner or guest session. */
export async function getLearningProfile(language = "en"): Promise<LearningProfileView | null> {
  "use cache: private";

  const session = await getSession();

  if (!session) {
    return null;
  }

  cacheTag(getLearningProfileCacheTag(session.user.id), getGoalsCacheTag(session.user.id));

  return findLearningProfileView({
    knownProfile: readLearningProfile(session.user.id),
    language,
    readRecentCountries,
    userId: session.user.id,
  });
}
