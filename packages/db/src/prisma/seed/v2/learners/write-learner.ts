import { type PrismaClient } from "../../../../generated/prisma/client";
import { findSkillIds } from "../library/write-skills";
import { courseLookup } from "./course-lookup";
import { type SeedLearner } from "./types";
import { writeLearnerExtras } from "./write-extras";
import { type LearnerScope, writeGoal } from "./write-goal";
import { writeHistory } from "./write-history";
import { writeLanguageHistory } from "./write-language";
import { writeAttempts, writeLearnerSkills } from "./write-learning";
import { type SeededPast, writePastSessions } from "./write-past-sessions";
import { type SeededToday, clearSessions, toSeededToday } from "./write-session";
import { writeLearnerUser } from "./write-user";

/**
 * A learner the seed wrote. `today` is the session the persona opened today, which core builds with
 * the app's session builder once the plan is made (see `SeededToday`), and `past` the bosses and
 * mocks of its past sessions, whose questions core picks then (see `SeededPast`).
 */
export type SeededLearner = {
  email: string;
  goalId: string;
  past: SeededPast;
  today: SeededToday | null;
  userId: string;
};

/**
 * Writes one learner end to end: account and profile, their goal with its plan, memory of each
 * skill, answers and mistakes, weeks of history with their sessions, memory facts, milestones and
 * votes. Today's session and the questions of past bosses and mocks wait for its plan: see
 * `SeededLearner`.
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
  const { course } = learner.goal;

  if (!learner.session && learner.attempts.some((attempt) => attempt.inSession)) {
    throw new Error(
      `${learner.name} has answers in today's session, which the seed doesn't write.`,
    );
  }

  const [userId, skillIds] = await Promise.all([
    writeLearnerUser({ learner, now, prisma }),
    findSkillIds({ course, language: learner.language, prisma }),
  ]);

  const scope: LearnerScope = {
    learner,
    lookup: courseLookup(course, learner.language, skillIds),
    now,
    prisma,
    userId,
  };

  const goalId = await writeGoal(scope, learner.goal);

  await prisma.userLearningProfile.update({ data: { activeGoalId: goalId }, where: { userId } });

  await clearSessions(scope, goalId);

  const [past] = await Promise.all([
    writePastSessions(scope, goalId),
    writeLearnerSkills(scope),
    writeAttempts(scope, { inSession: false, sessionId: null }),
    writeHistory(scope, goalId),
    writeLearnerExtras(scope),
    writeLanguageHistory({ ...scope, goalId }),
  ]);

  return {
    email: learner.email,
    goalId,
    past,
    today: learner.session ? toSeededToday(scope, { goalId, session: learner.session }) : null,
    userId,
  };
}
