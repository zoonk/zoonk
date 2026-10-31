import "server-only";
import { type GoalKind, prisma } from "@zoonk/db";
import { findActiveGoalId } from "../goals/_utils/goal-view";
import { getAnswerTimeZone } from "../learner/_utils/owned-goal";
import {
  type LessonGenerationState,
  getLessonGenerationStates,
} from "../library/generation/lesson-generation-state";
import { getSession } from "../users/get-session";
import { withLessonScreens } from "./_utils/lesson-screens";
import { readSavedDayView } from "./_utils/read-saved-day-view";
import { readStudyDay } from "./_utils/read-study-day";
import { type StudySessionView } from "./_utils/session-view";
import { STUDY_SESSION_INCLUDE } from "./_utils/study-session-access";
import { type TodayStudySessionInput } from "./contract";
import { type DayBlockRef, toDayBlockRef } from "./day-block";
import { type UnstartedDayView } from "./day-view";

export type NextStopFacts = { ref: DayBlockRef; lessonState: LessonGenerationState | null };
type SessionPageFields = {
  dayEndsAt: number;
  goal: { id: string; kind: GoalKind };
  lessonStatus: Record<string, LessonGenerationState["status"]>;
  localDate: Date;
  next: NextStopFacts | null;
  userId: string;
};
export type SessionPageView = SessionPageFields & { session: StudySessionView };
type SessionPageViewResult =
  | { status: "unauthorized" | "notFound" | "noGoal" | "goalNotActive" }
  | { goal: SessionPageFields["goal"]; status: "preparing" }
  | (SessionPageFields & { day: UnstartedDayView; status: "unstarted" })
  | (SessionPageView & { status: "ready" });

function readNextStop({
  lessons,
  session,
}: {
  lessons: ReadonlyMap<string, LessonGenerationState>;
  session: StudySessionView | UnstartedDayView;
}): NextStopFacts | null {
  const next = session.blocks.find((block) => block.position === session.nextPosition);

  return next
    ? {
        lessonState: next.lessonId ? (lessons.get(next.lessonId) ?? null) : null,
        ref: toDayBlockRef(next),
      }
    : null;
}

/** Read-only entry data; never creates session or block ids. */
export async function getSessionPageView(
  input: TodayStudySessionInput & { blockId?: string },
): Promise<SessionPageViewResult> {
  "use cache: private";

  const actor = await getSession();

  if (!actor) {
    return { status: "unauthorized" };
  }

  if (input.blockId && input.goalId) {
    return { status: "notFound" };
  }

  const userId = actor.user.id;

  const saved = input.blockId
    ? await prisma.studySession.findFirst({
        include: STUDY_SESSION_INCLUDE,
        where: { blocks: { some: { id: input.blockId } }, userId },
      })
    : null;

  if (input.blockId && !saved?.goal) {
    return { status: "notFound" };
  }

  const goalId = saved?.goalId ?? input.goalId ?? (await findActiveGoalId(userId));

  if (!goalId) {
    return { status: "noGoal" };
  }

  const goal = saved?.goal ?? (await prisma.goal.findFirst({ where: { id: goalId, userId } }));

  if (!goal) {
    return { status: "notFound" };
  }

  if (goal.status !== "active") {
    return { status: "goalNotActive" };
  }

  const timeZone = getAnswerTimeZone({ goal, timeZone: input.timeZone });

  const day = saved
    ? { session: await readSavedDayView({ session: saved, timeZone, userId }) }
    : await readStudyDay({ goal, now: new Date(), timeZone, userId });

  const goalView = { id: goal.id, kind: goal.kind };

  if (!day) {
    return { goal: goalView, status: "preparing" };
  }

  const session = day.session;

  const lessons = await getLessonGenerationStates([
    ...new Set(session.blocks.flatMap((block) => block.lessonId ?? [])),
  ]);

  const fields: SessionPageFields = {
    dayEndsAt: session.dayEndsAt,
    goal: goalView,
    lessonStatus: Object.fromEntries([...lessons].map(([id, state]) => [id, state.status])),
    localDate: session.localDate,
    next: readNextStop({ lessons, session }),
    userId,
  };

  const screened = withLessonScreens(session, lessons);

  return screened.status === "unstarted"
    ? { ...fields, day: screened, status: "unstarted" }
    : { ...fields, session: screened, status: "ready" };
}
