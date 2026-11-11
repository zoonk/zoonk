import "server-only";
import { getSession } from "../../users/get-session";
import { type ResumeDraft, findResumeDraft } from "./_utils/resume-draft";

export async function getUnfinishedOnboardingDraft(): Promise<ResumeDraft | null> {
  const session = await getSession();
  return session ? findResumeDraft(session.user.id) : null;
}
