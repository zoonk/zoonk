import "server-only";
import { type SupportedLocale } from "@zoonk/utils/locale";
import { readProfileQuestionState } from "../../learner/facts/profile-questions";
import { getSession } from "../../users/get-session";
import { toProfileQuestionsView } from "./_utils/profile-question-state";
import { type ProfileQuestionsView } from "./profile-question-contract";

export async function getProfileQuestions({
  locale,
}: {
  locale: SupportedLocale;
}): Promise<ProfileQuestionsView | null> {
  "use cache: private";
  const session = await getSession();

  if (!session) {
    return null;
  }

  return toProfileQuestionsView({ locale, state: await readProfileQuestionState(session.user.id) });
}
