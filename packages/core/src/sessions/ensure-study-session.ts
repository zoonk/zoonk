import "server-only";
import { type Goal, prisma } from "@zoonk/db";
import { loadSessionBuildInput } from "./_utils/load-build-inputs";
import { loadPlanVersion } from "./_utils/refresh-day-session";
import { refreshPlanAroundSession } from "./_utils/refresh-plan";
import { STUDY_SESSION_INCLUDE, type StudySessionRow } from "./_utils/study-session-access";
import { buildSessionBlocks } from "./session-builder";

type SessionDay = {
  goal: Goal;
  /** The learner-local date the session belongs to, as a UTC-midnight label. */
  localDate: Date;
  timeZone: string;
  userId: string;
};

function findSession({ goal, localDate, userId }: SessionDay) {
  return prisma.studySession.findUnique({
    include: STUDY_SESSION_INCLUDE,
    where: { userGoalDate: { goalId: goal.id, localDate, userId } },
  });
}

/**
 * Returns the goal's session for one learner-local day, building it the first time. Building is
 * idempotent: the session row is unique per goal and day, so two requests at once end up with the
 * same session and blocks, and a session never changes once built, so the day stays stable.
 *
 * Internal: public capabilities derive `userId` and the owned goal from the signed-in learner.
 */
export async function ensureStudySession(day: SessionDay): Promise<StudySessionRow> {
  const existing = await findSession(day);

  if (existing) {
    return existing;
  }

  await refreshPlanAroundSession({ goalId: day.goal.id, pace: "saved", revalidation: "skip" });

  // Read before the day is built from the plan: a change landing meanwhile reads as newer.
  const planVersion = await loadPlanVersion(day.goal.id);
  const input = await loadSessionBuildInput({ ...day, now: new Date() });
  const { blocks, plannedMinutes } = buildSessionBlocks(input);

  await prisma.$transaction(async (tx) => {
    const { count } = await tx.studySession.createMany({
      data: [
        {
          freshStart: input.freshStart,
          goalId: day.goal.id,
          localDate: day.localDate,
          planVersion,
          plannedMinutes,
          userId: day.userId,
        },
      ],
      skipDuplicates: true,
    });

    if (count === 0) {
      return;
    }

    const session = await tx.studySession.findUniqueOrThrow({
      where: {
        userGoalDate: { goalId: day.goal.id, localDate: day.localDate, userId: day.userId },
      },
    });

    await tx.studySessionBlock.createMany({
      data: blocks.map((block, position) => ({ ...block, position, sessionId: session.id })),
    });
  });

  const session = await findSession(day);

  if (!session) {
    throw new Error(`Study session for goal ${day.goal.id} was not created.`);
  }

  return session;
}
