import "server-only";
import { prisma } from "@zoonk/db";
import { getAnswerTimeZone } from "../learner/_utils/owned-goal";
import { settleQuestionBlock } from "./_utils/settle-question-block";
import { settleSessionDay } from "./_utils/settle-session-day";
import { type StudySessionRow, findOwnedStudySession } from "./_utils/study-session-access";
import { type StudySessionTimeZoneInput } from "./contract";
import { finishLessonBlock } from "./finish-study-block";
import {
  type StudySessionSummaryResult,
  getStudySessionSummary,
} from "./get-study-session-summary";

type StopContext = { session: StudySessionRow; timeZone: string; userId: string };

/**
 * A block in progress keeps what was already done: answered questions are scored and a lesson
 * finished in the player counts. A duel left halfway isn't judged; its plan item waits for another
 * day.
 */
async function settleActiveBlocks({ session, timeZone, userId }: StopContext) {
  const active = session.blocks.filter((block) => block.status === "active");

  await Promise.all(
    active.map((block) =>
      block.kind === "learn"
        ? finishLessonBlock({ block, session, timeZone, userId })
        : settleQuestionBlock({ block, session, timeZone, userId }),
    ),
  );
}

/**
 * "Stop for today": whatever was done counts (partial days are days studied), the rest of the
 * session is skipped without any penalty, and the end-of-session summary says what changed.
 */
export async function stopStudySession({
  input,
  sessionId,
}: {
  input: StudySessionTimeZoneInput;
  sessionId: string;
}): Promise<StudySessionSummaryResult> {
  const owned = await findOwnedStudySession(sessionId);

  if (owned.status !== "ready") {
    return owned;
  }

  const { session, userId } = owned;
  const timeZone = getAnswerTimeZone({ goal: session.goal, timeZone: input.timeZone });

  await settleActiveBlocks({ session, timeZone, userId });

  await prisma.studySessionBlock.updateMany({
    data: { status: "skipped" },
    where: { sessionId: session.id, status: { in: ["active", "pending"] } },
  });

  await settleSessionDay({ sessionId: session.id, timeZone, userId });

  return getStudySessionSummary({ input, sessionId });
}
