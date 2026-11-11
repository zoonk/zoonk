import "server-only";
import { cacheTag } from "next/cache";
import {
  getGoalsCacheTag,
  getLearningProfileCacheTag,
  getStudyReminderCacheTag,
  getUserProgressCacheTag,
} from "../cache/tags";
import { getRequestInstant } from "../learner/facts/request-instant";
import { getSession } from "../users/get-session";
import { findStudyReminderView } from "./_utils/study-reminder-view";
import { type StudyReminderView } from "./study-reminder-contract";

/** Returns null without a learner or guest session; never creates the reminder row. */
export async function getStudyReminder(): Promise<StudyReminderView | null> {
  "use cache: private";

  const session = await getSession();

  if (!session) {
    return null;
  }

  const userId = session.user.id;

  cacheTag(
    getStudyReminderCacheTag(userId),
    getUserProgressCacheTag(userId),
    getGoalsCacheTag(userId),
    getLearningProfileCacheTag(userId),
  );

  return findStudyReminderView({ now: await getRequestInstant(), user: session.user });
}
