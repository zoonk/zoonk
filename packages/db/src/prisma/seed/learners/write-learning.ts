import { MS_PER_SECOND } from "@zoonk/utils/date";
import { type AttemptEvidence } from "../../../generated/prisma/client";
import { atLocalHour, localTimeFields, minutesBefore } from "../_utils/dates";
import { localizeObject } from "../_utils/localize";
import { seedId } from "../_utils/seed-id";
import { answeredStepId } from "./answered-step";
import { toLearnerSkillMemory } from "./memory-presets";
import { type SeedAttempt } from "./types";
import { type LearnerScope } from "./write-goal";

function studyHour(scope: Pick<LearnerScope, "learner">): number {
  return Number(scope.learner.goal.studyTime.split(":")[0]);
}

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

  const moment = minutesBefore(start, -order);
  return moment > scope.now ? scope.now : moment;
}

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

/** True when an earlier miss of the same bank question is still in the notebook at `attempt`. */
function asksNotebookQuestion(attempts: readonly SeedAttempt[], attempt: SeedAttempt): boolean {
  return attempts.some(
    (earlier) =>
      earlier !== attempt &&
      earlier.item === attempt.item &&
      earlier.mistake !== undefined &&
      earlier.day < attempt.day &&
      (earlier.mistake.status === "open" || (earlier.mistake.fixedDay ?? -1) >= attempt.day),
  );
}

/**
 * The evidence core's answer writer gives the same answer: `getAttemptEvidence` and
 * `writeAttemptAttribution` in `core/src/learner`, and `getStudyAnswerEvidence` for review and
 * practice. `core/src/seed/seeded-mistake-signal.test.ts` holds the two together.
 */
export function getSeedAnswerEvidence(
  attempts: readonly SeedAttempt[],
  attempt: SeedAttempt,
): AttemptEvidence | null {
  if (attempt.placement) {
    return null;
  }

  if (!attempt.item) {
    return "guided";
  }

  return asksNotebookQuestion(attempts, attempt) ? "replay" : "independent";
}

async function writeAttempt(
  scope: LearnerScope,
  attempt: SeedAttempt,
  { order, sessionId }: { order: number; sessionId: string | null },
) {
  const { learner, lookup, prisma, userId } = scope;
  const id = seedId(`learner:${learner.key}:attempt:${attempt.key}`);
  const answeredAt = studyMoment(scope, attempt.day, order);
  const skillId = lookup.skill(attempt.skill);
  const itemId = attempt.item ? lookup.item(attempt.item) : null;
  const stepId = answeredStepId({ attempt, learner, lookup });

  const data = {
    answer: attempt.answer,
    answeredAt,
    cause: attempt.isCorrect ? null : (attempt.mistake?.cause ?? null),
    durationMs: attempt.seconds * MS_PER_SECOND,
    evidence: getSeedAnswerEvidence(learner.attempts, attempt),
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
    missedAt: answeredAt,
    skillId,
    snapshot: localizeObject(attempt.mistake.snapshot, learner.language),
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

export async function writeAttempts(
  scope: LearnerScope,
  { inSession, sessionId }: { inSession: boolean; sessionId: string | null },
): Promise<void> {
  await Promise.all(
    scope.learner.attempts.flatMap((attempt, order) =>
      Boolean(attempt.inSession) === inSession
        ? [writeAttempt(scope, attempt, { order, sessionId })]
        : [],
    ),
  );
}
