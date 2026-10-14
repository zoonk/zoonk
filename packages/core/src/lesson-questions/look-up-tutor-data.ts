import "server-only";
import {
  type GoalTutorLookUpRequest,
  type GoalTutorLookUpResult,
  isLearnerLookUp,
  isPlanLookUp,
} from "@zoonk/ai/tasks/v2/tutor/goal-tutor-lookup";
import { type Goal, prisma } from "@zoonk/db";
import { isUuid } from "@zoonk/utils/uuid";
import { getSession } from "../users/get-session";
import { findAnsweringGoal } from "./_utils/answering-question";
import { parseLessonQuestionContextSnapshot } from "./_utils/context-snapshot-schema";
import { lookUpLearnerData } from "./_utils/lookups/learner-lookups";
import { lookUpLesson } from "./_utils/lookups/lesson-lookup";
import { lookUpMistakes } from "./_utils/lookups/mistake-lookup";
import { lookUpMocks } from "./_utils/lookups/mock-lookup";
import { lookUpPlanData } from "./_utils/lookups/plan-lookups";
import { lookUpNoticeTopics, lookUpSubjectProgress } from "./_utils/lookups/syllabus-lookups";
import { type LinkScope } from "./_utils/plan-day-context";

type Lookup = { area: string | null; goal: Goal; query: string | null };

/**
 * What a lookup may link for this question, as its context does (see `LinkScope`): what acts on
 * the open goal only in the buddy's own conversation about it, as its snapshot recorded it.
 */
async function loadLinkScope(questionId: string): Promise<LinkScope> {
  const question = await prisma.lessonQuestion.findUnique({
    select: { contextSnapshot: true },
    where: { id: questionId },
  });

  const snapshot = question ? parseLessonQuestionContextSnapshot(question.contextSnapshot) : null;

  return {
    activeGoal: snapshot !== null && "selectedGoal" in snapshot && snapshot.selectedGoal === true,
  };
}

async function lookUp({
  questionId,
  what,
  ...lookup
}: Lookup & Pick<GoalTutorLookUpRequest, "what"> & { questionId: string }) {
  if (isPlanLookUp(what)) {
    return lookUpPlanData({ ...lookup, linkScope: await loadLinkScope(questionId), what });
  }

  if (isLearnerLookUp(what)) {
    return lookUpLearnerData({ ...lookup, linkScope: await loadLinkScope(questionId), what });
  }

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

  return lookUp({ area: toWords(area), goal, query: toWords(query), questionId, what });
}
