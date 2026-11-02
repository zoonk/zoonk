import { type Attempt, type LearnerSkill, type Mistake, prisma } from "@zoonk/db";
import { toUTCMidnight } from "@zoonk/utils/date";
import { type FixtureAttrs } from "./_utils/fixture-attrs";

const DEFAULT_ATTEMPT_DURATION_MS = 5000;

export async function learnerSkillFixture(
  attrs: FixtureAttrs<LearnerSkill> & Pick<LearnerSkill, "skillId" | "userId">,
) {
  return prisma.learnerSkill.create({ data: attrs });
}

/** The local date, hour and weekday come from `answeredAt` in UTC. */
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

export async function mistakeFixture(
  attrs: FixtureAttrs<Mistake, "snapshot"> & Pick<Mistake, "userId">,
) {
  return prisma.mistake.create({
    data: { snapshot: { answer: "Wrong answer", question: "Test question?" }, ...attrs },
  });
}
