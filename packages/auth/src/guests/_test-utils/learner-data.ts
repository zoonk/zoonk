import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";

const STUDY_DAY = new Date("2026-09-20T00:00:00Z");
const STUDY_HOUR = 10;
const STUDY_WEEKDAY = 0;
const DAILY_MINUTES = 20;

/** Creates a Library skill directly, since this package can't depend on the shared fixtures. */
export async function createSkill() {
  const id = randomUUID();

  return prisma.skill.create({
    data: {
      description: "A test idea in one sentence",
      identityKey: `guest-link-skill-${id}`,
      language: "en",
      model: "test-model",
      name: `Guest link skill ${id}`,
      normalizedName: `guest link skill ${id}`,
      promptVersion: "test",
      runId: `test-run-${id}`,
    },
  });
}

/**
 * Gives a learner one row of everything a guest can create: a goal with its plan, a typed goal
 * not confirmed yet, a skill, an answer, a memory, votes, a milestone, a day of stats, usage and a
 * profile.
 */
export async function seedLearnerData({
  brainPower,
  contentId,
  skillId,
  userId,
}: {
  brainPower: number;
  contentId: string;
  skillId: string;
  userId: string;
}) {
  const goal = await prisma.goal.create({
    data: {
      dailyMinutes: DAILY_MINUTES,
      kind: "learn",
      language: "en",
      prompt: "Learn photosynthesis",
      title: "Photosynthesis",
      userId,
    },
  });

  const studyTime = { hour: STUDY_HOUR, localDate: STUDY_DAY, weekday: STUDY_WEEKDAY };

  await Promise.all([
    prisma.plan.create({ data: { goalId: goal.id } }),
    prisma.onboardingDraft.create({
      data: { language: "en", prompt: "Learn chemistry", timeZone: "UTC", userId },
    }),
    prisma.learnerSkill.create({ data: { reps: brainPower, skillId, userId } }),
    prisma.attempt.create({
      data: { answer: {}, durationMs: 1000, isCorrect: true, skillId, userId, ...studyTime },
    }),
    prisma.memoryFact.create({
      data: { category: "learning", origin: "said", statement: "Prefers examples", userId },
    }),
    prisma.learningEvent.create({
      data: { brainPower, kind: "lesson", startedAt: STUDY_DAY, userId, ...studyTime },
    }),
    prisma.feedback.create({ data: { message: "Loved it", userId } }),
    prisma.contentFeedback.create({
      data: { contentId, contentKind: "lesson", userId, vote: brainPower > 1 ? "up" : "down" },
    }),
    prisma.milestone.create({ data: { key: "star", kind: "glasses", userId } }),
    prisma.dailyProgress.create({
      data: { brainPowerEarned: brainPower, date: STUDY_DAY, dayOfWeek: STUDY_WEEKDAY, userId },
    }),
    prisma.usageRecord.create({ data: { kind: "lessonStart", targetId: randomUUID(), userId } }),
    prisma.userProgress.update({ data: { totalBrainPower: brainPower }, where: { userId } }),
  ]);

  await prisma.userLearningProfile.create({
    data: {
      activeGoalId: goal.id,
      buddyKind: "zu",
      buddyName: "Zuzu",
      experienceMode: "fun",
      userId,
    },
  });

  return { goal };
}

/** Counts a learner's rows in every table a guest link moves. */
export async function countLearnerRows(userId: string) {
  const byUser = { where: { userId } };

  const counts = await Promise.all([
    prisma.goal.count(byUser),
    prisma.onboardingDraft.count(byUser),
    prisma.learnerSkill.count(byUser),
    prisma.attempt.count(byUser),
    prisma.memoryFact.count(byUser),
    prisma.learningEvent.count(byUser),
    prisma.feedback.count(byUser),
    prisma.contentFeedback.count(byUser),
    prisma.milestone.count(byUser),
    prisma.dailyProgress.count(byUser),
    prisma.usageRecord.count(byUser),
  ]);

  const [
    goals,
    drafts,
    skills,
    attempts,
    memory,
    events,
    feedback,
    votes,
    milestones,
    days,
    usage,
  ] = counts;

  return {
    attempts,
    days,
    drafts,
    events,
    feedback,
    goals,
    memory,
    milestones,
    skills,
    usage,
    votes,
  };
}
