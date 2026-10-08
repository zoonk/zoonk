import { atLocalHour, localTimeFields, minutesBefore } from "../_utils/dates";
import { seedId } from "../_utils/seed-id";
import { toLearnerSkillMemory } from "./memory-presets";
import { type SeedAttempt } from "./types";
import { type LearnerScope } from "./write-goal";

const MS_PER_SECOND = 1000;

/** The hour of the learner's study time, such as 19 for "19:00". */
function studyHour(scope: Pick<LearnerScope, "learner">): number {
  return Number(scope.learner.goal.studyTime.split(":")[0]);
}

/** When the learner did something `day` days from today, at their study time, `order` minutes in. */
export function studyMoment(
  scope: Pick<LearnerScope, "learner" | "now">,
  day: number,
  order = 0,
): Date {
  const start = atLocalHour({
    daysAgo: -day,
    hour: studyHour(scope),
    now: scope.now,
    timeZone: scope.learner.timeZone,
  });

  return minutesBefore(start, -order);
}

/** Each skill's memory, from New to Mastered or fading, as cards and skill lists read it. */
export async function writeLearnerSkills(scope: LearnerScope): Promise<void> {
  const { learner, lookup, now, prisma, userId } = scope;

  await Promise.all(
    learner.skills.map(({ memory, skill }) => {
      const skillId = lookup.skill(skill);
      const data = toLearnerSkillMemory(memory, now);

      return prisma.learnerSkill.upsert({
        create: { ...data, skillId, userId },
        update: data,
        where: { userSkill: { skillId, userId } },
      });
    }),
  );
}

async function writeAttempt(
  scope: LearnerScope,
  attempt: SeedAttempt,
  { order, sessionId }: { order: number; sessionId: string },
) {
  const { learner, lookup, prisma, userId } = scope;
  const id = seedId(`learner:${learner.key}:attempt:${attempt.key}`);
  const answeredAt = studyMoment(scope, attempt.day, order);
  const skillId = lookup.skill(attempt.skill);
  const itemId = attempt.item ? lookup.item(attempt.item) : null;
  const stepId = attempt.step ? lookup.step(attempt.step.lesson, attempt.step.position) : null;

  const data = {
    answer: attempt.answer,
    answeredAt,
    durationMs: attempt.seconds * MS_PER_SECOND,
    isCorrect: attempt.isCorrect,
    itemId,
    skillId,
    stepId,
    studySessionId: attempt.inSession ? sessionId : null,
    userId,
    ...localTimeFields(answeredAt, learner.timeZone),
  };

  await prisma.attempt.upsert({ create: { id, ...data }, update: data, where: { id } });

  if (!attempt.mistake) {
    return;
  }

  const mistakeId = seedId(`learner:${learner.key}:mistake:${attempt.key}`);

  const mistake = {
    attemptId: id,
    cause: attempt.mistake.cause,
    createdAt: answeredAt,
    fixedAt:
      attempt.mistake.status === "fixed"
        ? studyMoment(scope, attempt.mistake.fixedDay ?? -1)
        : null,
    itemId,
    skillId,
    snapshot: attempt.mistake.snapshot,
    status: attempt.mistake.status,
    stepId,
    userId,
  };

  await prisma.mistake.upsert({
    create: { id: mistakeId, ...mistake },
    update: mistake,
    where: { id: mistakeId },
  });
}

/** Answers with their learner-local time, and the mistakes notebook entries some of them left. */
export async function writeAttempts(scope: LearnerScope, sessionId: string): Promise<void> {
  await Promise.all(
    scope.learner.attempts.map((attempt, order) =>
      writeAttempt(scope, attempt, { order, sessionId }),
    ),
  );
}
