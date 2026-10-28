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

/** Read-only model context, never screen output; only the currently claimed answer may look up its own question's saved goal. */
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
