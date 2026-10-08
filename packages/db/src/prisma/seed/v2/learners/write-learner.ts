import { type PrismaClient } from "../../../../generated/prisma/client";
import { courseLookup } from "./course-lookup";
import { type SeedLearner } from "./types";
import { writeLearnerExtras } from "./write-extras";
import { type LearnerScope, writeGoal } from "./write-goal";
import { writeHistory } from "./write-history";
import { writeLanguageHistory } from "./write-language";
import { writeAttempts, writeLearnerSkills } from "./write-learning";
import { writeTodaySession } from "./write-session";
import { writeLearnerUser } from "./write-user";

type SeededLearner = { email: string; goalId: string; userId: string };

/**
 * Writes one learner end to end: account and profile, their goal with its plan, today's session,
 * memory of each skill, answers and mistakes, weeks of history, memory facts, milestones and votes.
 */
export async function writeLearner({
  learner,
  now,
  prisma,
}: {
  learner: SeedLearner;
  now: Date;
  prisma: PrismaClient;
}): Promise<SeededLearner> {
  const userId = await writeLearnerUser({ learner, now, prisma });

  const scope: LearnerScope = {
    learner,
    lookup: courseLookup(learner.goal.course, learner.language),
    now,
    prisma,
    userId,
  };

  const goalId = await writeGoal(scope, learner.goal);

  await prisma.userLearningProfile.update({ data: { activeGoalId: goalId }, where: { userId } });

  const sessionId = await writeTodaySession(scope, goalId);

  await Promise.all([
    writeLearnerSkills(scope),
    writeAttempts(scope, sessionId),
    writeHistory(scope, goalId),
    writeLearnerExtras(scope),
    writeLanguageHistory({ ...scope, goalId }),
  ]);

  return { email: learner.email, goalId, userId };
}
