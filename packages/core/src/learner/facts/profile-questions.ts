import "server-only";
import { cacheTag } from "next/cache";
import { getLearningProfileCacheTag, getMemoryCacheTag } from "../../cache/tags";
import { loadProfileQuestionState } from "../../profile/questions/_utils/profile-question-state";
import { readLearningProfile } from "./learning-profile";

export async function readProfileQuestionState(userId: string) {
  "use cache: private";
  cacheTag(getLearningProfileCacheTag(userId), getMemoryCacheTag(userId));
  return loadProfileQuestionState({ profile: readLearningProfile(userId), userId });
}
