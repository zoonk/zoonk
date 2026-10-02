import { type StudySession, type StudySessionBlock, prisma } from "@zoonk/db";
import { toUTCMidnight } from "@zoonk/utils/date";
import { type FixtureAttrs } from "./_utils/fixture-attrs";

const DEFAULT_PLANNED_MINUTES = 20;

/** Creates today's planned study session for a learner. */
export async function studySessionFixture(
  attrs: FixtureAttrs<StudySession, "startSnapshot"> & Pick<StudySession, "userId">,
) {
  return prisma.studySession.create({
    data: {
      localDate: toUTCMidnight(new Date()),
      plannedMinutes: DEFAULT_PLANNED_MINUTES,
      ...attrs,
    },
  });
}

/**
 * Creates a session block. Without a position it goes after the session's current blocks; tests that
 * add several blocks in parallel should pass positions.
 */
export async function studySessionBlockFixture(
  attrs: FixtureAttrs<StudySessionBlock, "payload"> & Pick<StudySessionBlock, "sessionId">,
) {
  const position =
    attrs.position ??
    (await prisma.studySessionBlock.count({ where: { sessionId: attrs.sessionId } }));

  return prisma.studySessionBlock.create({ data: { kind: "learn", ...attrs, position } });
}
