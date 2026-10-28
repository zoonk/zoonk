import "server-only";
import { prisma } from "@zoonk/db";
import { AWAITING_OUTLINES_VERSION, loadDayPlanVersion } from "./day-plan-version";
import { withSessionAppendLock } from "./extra-blocks";
import { hasSameBlocks, planRestOfDay } from "./refresh-day-session";
import { STUDY_SESSION_INCLUDE, type StudySessionRow } from "./study-session-access";

/**
 * A day opened while it held time for lessons still being outlined (its plan version says so, see
 * `loadDayPlanVersion`): once they land, or nobody is writing them anymore, the learner's next Open
 * or Continue adds the new lessons to its end, up to the day's time, without moving anything they
 * were shown, as Today's "more as you go" said. A finished day stays as it is. Returns the day as
 * it is now.
 */
export async function appendLandedLessons({
  goal,
  session,
  timeZone,
}: Parameters<typeof planRestOfDay>[0]["day"]): Promise<StudySessionRow> {
  if (session.planVersion !== AWAITING_OUTLINES_VERSION || session.status === "completed") {
    return session;
  }

  const planVersion = await loadDayPlanVersion({ goal, localDate: session.localDate });

  if (planVersion === AWAITING_OUTLINES_VERSION) {
    return session;
  }

  const planned = await planRestOfDay({ day: { goal, session, timeZone }, kept: session.blocks });
  const lessons = planned.filter((block) => block.kind === "learn");

  if (lessons.length === 0) {
    await prisma.studySession.update({ data: { planVersion }, where: { id: session.id } });
    return { ...session, planVersion };
  }

  await withSessionAppendLock({
    run: async ({ session: locked, transaction }) => {
      if (
        locked.status === "completed" ||
        !hasSameBlocks({ locked: locked.blocks, read: session.blocks })
      ) {
        return;
      }

      const firstPosition = Math.max(-1, ...session.blocks.map((block) => block.position)) + 1;

      await transaction.studySessionBlock.createMany({
        data: lessons.map((block, index) => ({
          ...block,
          position: firstPosition + index,
          sessionId: session.id,
        })),
      });

      await transaction.studySession.update({
        data: {
          planVersion,
          plannedMinutes:
            session.blocks.reduce((sum, block) => sum + (block.estimatedMinutes ?? 0), 0) +
            lessons.reduce((sum, block) => sum + block.estimatedMinutes, 0),
        },
        where: { id: session.id },
      });
    },
    session,
  });

  return prisma.studySession.findUniqueOrThrow({
    include: STUDY_SESSION_INCLUDE,
    where: { id: session.id },
  });
}
