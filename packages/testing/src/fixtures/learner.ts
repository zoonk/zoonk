import { type Attempt, type LearnerSkill, type Mistake, prisma } from "@zoonk/db";
import { toUTCMidnight } from "@zoonk/utils/date";
import { type FixtureAttrs } from "./_utils/fixture-attrs";

const DEFAULT_ATTEMPT_DURATION_MS = 5000;

/** Creates a learner's mastery state for a skill (New until reviewed). */
export async function learnerSkillFixture(
  attrs: FixtureAttrs<LearnerSkill> & Pick<LearnerSkill, "skillId" | "userId">,
) {
  return prisma.learnerSkill.create({ data: attrs });
}

/** Records one answer, with local date, hour and weekday taken from `answeredAt` in UTC. */
export async function attemptFixture(
  attrs: FixtureAttrs<Attempt, "answer"> & Pick<Attempt, "userId">,
) {
  const answeredAt = attrs.answeredAt ?? new Date();

  return prisma.attempt.create({
    data: {
      answer: { selectedIndex: 0 },
      durationMs: DEFAULT_ATTEMPT_DURATION_MS,
      hour: answeredAt.getUTCHours(),
      isCorrect: true,
      localDate: toUTCMidnight(answeredAt),
      weekday: answeredAt.getUTCDay(),
      ...attrs,
      answeredAt,
    },
  });
}

/** Adds an open entry to a learner's mistakes notebook. */
export async function mistakeFixture(
  attrs: FixtureAttrs<Mistake, "snapshot"> & Pick<Mistake, "userId">,
) {
  return prisma.mistake.create({
    data: { snapshot: { answer: "Wrong answer", question: "Test question?" }, ...attrs },
  });
}
