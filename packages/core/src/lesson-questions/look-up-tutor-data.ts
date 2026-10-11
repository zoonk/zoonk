import "server-only";
import {
  type GoalTutorLookUpRequest,
  type GoalTutorLookUpResult,
} from "@zoonk/ai/tasks/v2/tutor/goal-tutor-lookup";
import { type Goal } from "@zoonk/db";
import { isUuid } from "@zoonk/utils/uuid";
import { getSession } from "../users/get-session";
import { findAnsweringGoal } from "./_utils/answering-question";
import { lookUpLesson } from "./_utils/lookups/lesson-lookup";
import { lookUpMistakes } from "./_utils/lookups/mistake-lookup";
import { lookUpMocks } from "./_utils/lookups/mock-lookup";
import { lookUpNoticeTopics, lookUpSubjectProgress } from "./_utils/lookups/syllabus-lookups";

type Lookup = { area: string | null; goal: Goal; query: string | null };

function lookUp({ what, ...lookup }: Lookup & Pick<GoalTutorLookUpRequest, "what">) {
  switch (what) {
    case "noticeTopics":
      return lookUpNoticeTopics(lookup);
    case "subjectProgress":
      return lookUpSubjectProgress(lookup);
    case "mocks":
      return lookUpMocks(lookup.goal);
    case "lesson":
      return lookUpLesson(lookup);
    case "mistakes":
      return lookUpMistakes(lookup);
    default:
      return what satisfies never;
  }
}

function toWords(text: string | null): string | null {
  return text?.trim() || null;
}

/**
 * The buddy looks up the learner's own data its context doesn't show while it answers them: the
 * exam notice's topics, progress by subject, the mocks they finished, a lesson of their plan or
 * their older mistakes. Read only, and only the goal the answer is about: the generation still
 * writing the learner's own answer inside one of their goals may look up (in the buddy's
 * conversation, or on a chapter, a lesson or a mock of that goal). What it finds goes to the model
 * alone, never to the learner's screen.
 */
export async function lookUpTutorData({
  area,
  query,
  questionId,
  revision,
  what,
}: GoalTutorLookUpRequest & { questionId: string; revision: number }): Promise<
  GoalTutorLookUpResult | { status: "unauthorized" }
> {
  const session = await getSession();

  if (!session) {
    return { status: "unauthorized" };
  }

  const goal = isUuid(questionId)
    ? await findAnsweringGoal({ questionId, revision, userId: session.user.id })
    : null;

  if (!goal) {
    return { status: "notFound", what };
  }

  return lookUp({ area: toWords(area), goal, query: toWords(query), what });
}
