import {
  type ProfileQuestionsView,
  isBiographyQuestion,
} from "@zoonk/core/profile/questions/contract";
import { type ProfileQuestion } from "./profile-draft";

/** About you's questions, grouped and ordered as its list shows them. */
export const ABOUT_YOU_GROUPS = [
  { id: "day", questions: ["work", "tools", "studies"] },
  { id: "fun", questions: ["watch", "listen", "play", "read", "activities"] },
  { id: "learn", questions: ["addressForm", "conditions", "learningSupport"] },
] as const satisfies { id: string; questions: ProfileQuestion[] }[];

/**
 * The question a wide screen opens beside the list before the learner picks one: the first down
 * the list they can still answer, else the first they can change. With memory off only how they
 * learn can change.
 */
export function firstOpenAboutYouQuestion(view: ProfileQuestionsView) {
  const open = ABOUT_YOU_GROUPS.flatMap((group) => group.questions)
    .filter((id) => view.memoryEnabled || !isBiographyQuestion(id))
    .flatMap((id) => view.questions.find((question) => question.id === id) ?? []);

  return open.find((question) => question.status === null) ?? open[0] ?? null;
}
