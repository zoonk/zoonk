import "server-only";
import { cacheTag } from "next/cache";
import { getGoalsCacheTag, getOnboardingDraftsCacheTag } from "../../cache/tags";
import { getSession } from "../../users/get-session";
import { type ResumeDraft, findResumeDraft } from "./_utils/resume-draft";

export async function getUnfinishedOnboardingDraft(): Promise<ResumeDraft | null> {
  "use cache: private";

  const session = await getSession();

  if (!session) {
    return null;
  }

  cacheTag(getGoalsCacheTag(session.user.id), getOnboardingDraftsCacheTag(session.user.id));
  return findResumeDraft(session.user.id);
}
