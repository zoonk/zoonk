import { type LearnerSkill, type TransactionClient } from "@zoonk/db";
import { isSecondTakeIdentityKey } from "../../library/second-takes/second-take-identity";
import { CAPSULE_LEDGER_KIND } from "../../milestones/award-milestones";
import { type LearnerAnswer } from "../record-learner-answer";

export type LessonAnswerRun = { lessonId: string; startedAt: Date };

async function getLessonAnswerEvidence({
  answeredAt,
  before,
  db,
  run,
  skillId,
  stepId,
  userId,
}: {
  answeredAt: Date;
  before: LearnerSkill | null;
  db: TransactionClient;
  run: LessonAnswerRun;
  skillId: string;
  stepId: string;
  userId: string;
}): Promise<"guided" | "independent"> {
  const lesson = await db.lesson.findUnique({
    select: { identityKey: true, skills: { select: { skillId: true }, where: { skillId } } },
    where: { id: run.lessonId },
  });

  // A first-take check can be independent only when it tests a skill taught elsewhere.
  if (!lesson || isSecondTakeIdentityKey(lesson.identityKey) || lesson.skills.length > 0) {
    return "guided";
  }

  const [finished, earlierAnswer] = await Promise.all([
    db.learningEvent.findFirst({
      select: { id: true },
      where: {
        OR: [{ lessonKind: null }, { lessonKind: { not: CAPSULE_LEDGER_KIND } }],
        contentIds: { equals: run.lessonId, path: ["lessonId"] },
        endedAt: { lte: answeredAt },
        kind: { in: ["lesson", "review"] },
        userId,
      },
    }),
    db.attempt.findFirst({
      select: { id: true },
      where: { answeredAt: { gte: run.startedAt, lte: answeredAt }, stepId, userId },
    }),
  ]);

  if (finished || earlierAnswer) {
    return "guided";
  }

  if (before?.helpedAt && before.helpedAt <= run.startedAt) {
    return "independent";
  }

  const [earlierTeaching] = await db.$queryRaw<{ taught: boolean }[]>`
    SELECT EXISTS (
      SELECT 1 FROM learning_events event
      JOIN lesson_skills link ON event.content_ids @> jsonb_build_object('lessonId', link.lesson_id)
      WHERE link.skill_id = ${skillId}::uuid AND event.user_id = ${userId}::uuid
        AND event.kind IN ('lesson', 'review') AND event.ended_at <= ${run.startedAt}
        AND event.lesson_kind IS DISTINCT FROM ${CAPSULE_LEDGER_KIND}
    ) AS taught
  `;

  return earlierTeaching?.taught ? "independent" : "guided";
}

export function getAttemptEvidence({
  answeredAt,
  before,
  input,
  skillId,
  stepId,
  transaction,
}: {
  answeredAt: Date;
  before: LearnerSkill | null;
  input: LearnerAnswer;
  skillId: string | null;
  stepId: string | null;
  transaction: TransactionClient;
}) {
  if (input.isPlacement || input.purpose === "diagnostic" || input.mockExamId) {
    return null;
  }

  if (input.practicedMistakeId) {
    return "replay";
  }

  if (!input.lessonRun) {
    return input.evidence ?? null;
  }

  if (!skillId || !stepId) {
    return "guided";
  }

  return getLessonAnswerEvidence({
    answeredAt,
    before,
    db: transaction,
    run: input.lessonRun,
    skillId,
    stepId,
    userId: input.userId,
  });
}
