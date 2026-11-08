import "server-only";
import { prisma } from "@zoonk/db";
import { getAnswerTimeZone } from "../../learner/_utils/owned-goal";
import { isCurrentSession } from "../../sessions/_utils/current-session";
import { STUDY_SESSION_INCLUDE } from "../../sessions/_utils/study-session-access";
import { openStudyBlock } from "../../sessions/open-block";
import { type StudyBlockOpening } from "../../sessions/open-block-contract";
import { openStudyDay } from "../../sessions/open-study-day";
import { type LibraryLessonStartInput } from "../contract";

type LessonOpening = NonNullable<LibraryLessonStartInput["opening"]>;

type ResolvedOpening =
  | { sessionId: string; status: "admitted" }
  | { opening: StudyBlockOpening; status: "opened" }
  | { status: "retryable" | "unauthorized" };

export async function resolveLessonStudyOpening({
  lessonId,
  now,
  opening,
  timeZone,
  userId,
}: {
  lessonId: string;
  now: Date;
  opening: LessonOpening;
  timeZone?: string;
  userId: string;
}): Promise<ResolvedOpening> {
  if ("goalId" in opening) {
    const result = await openStudyDay({ ...opening, timeZone: timeZone ?? opening.timeZone }, now);

    if (result.status === "retryable" || result.status === "unauthorized") {
      return { status: result.status };
    }

    if (result.status !== "opened") {
      return { opening: { kind: "today" }, status: "opened" };
    }

    if (result.targetStatus === "otherDay") {
      return { opening: { kind: "today" }, status: "opened" };
    }

    return resolveDestination({
      lessonId,
      opening: result.opening ?? { blockId: null, kind: "session", sessionId: result.sessionId },
    });
  }

  const target = opening.target;

  const session = await prisma.studySession.findFirst({
    include: STUDY_SESSION_INCLUDE,
    where: {
      userId,
      ...(target.kind === "next"
        ? { id: target.sessionId }
        : { blocks: { some: { id: target.blockId } } }),
    },
  });

  if (
    !session ||
    !isCurrentSession({
      now,
      session,
      timeZone: getAnswerTimeZone({ goal: session.goal, timeZone: timeZone ?? opening.timeZone }),
    })
  ) {
    return { opening: { kind: "today" }, status: "opened" };
  }

  const result = await openStudyBlock({ ...opening, timeZone: timeZone ?? opening.timeZone });

  if (result.status === "retryable" || result.status === "unauthorized") {
    return { status: result.status };
  }

  return result.status === "ready"
    ? resolveDestination({ lessonId, opening: result.opening })
    : { opening: { kind: "today" }, status: "opened" };
}

function resolveDestination({
  lessonId,
  opening,
}: {
  lessonId: string;
  opening: StudyBlockOpening;
}): ResolvedOpening {
  return opening.kind === "lesson" && opening.lessonId === lessonId
    ? { sessionId: opening.sessionId, status: "admitted" }
    : { opening, status: "opened" };
}
