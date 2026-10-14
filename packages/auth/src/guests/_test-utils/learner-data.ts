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

export function createGoal(userId: string) {
  return prisma.goal.create({
    data: {
      dailyMinutes: DAILY_MINUTES,
      kind: "learn",
      language: "en",
      prompt: "Learn photosynthesis",
      title: "Photosynthesis",
      userId,
    },
  });
}

/** Creates a Library lesson directly, for rows a learner keeps about one. */
export async function createLesson() {
  const id = randomUUID();

  return prisma.lesson.create({
    data: {
      description: "A test lesson",
      estimatedMinutes: 5,
      identityKey: `guest-link-lesson-${id}`,
      language: "en",
      level: "beginner",
      model: "test-model",
      normalizedTitle: `guest link lesson ${id}`,
      promptVersion: "test",
      runId: `test-run-${id}`,
      slug: `guest-link-lesson-${id}`,
      title: `Guest link lesson ${id}`,
    },
  });
}

/**
 * Gives a learner one row of everything a guest can create: a goal with its plan, a typed goal
 * not confirmed yet, a skill, an answer, a memory, votes, a milestone, a day of stats, usage, an AI
 * call and its evaluation, a practice conversation, a mistake pattern, a mock and an exam result,
 * and a profile.
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
  const goal = await createGoal(userId);

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
    prisma.aiCall.create({
      data: {
        contentScope: "personal",
        costUsd: 0.01,
        goalId: goal.id,
        latencyMs: 1000,
        model: "test-model",
        promptVersion: "test",
        provider: "test",
        requestedModel: "test-model",
        runId: `test-run-${contentId}`,
        task: "test-task",
        userId,
      },
    }),
    prisma.languageConversation.create({
      data: {
        goalId: goal.id,
        kind: "practice",
        language: "en",
        level: "A2",
        minutes: 5,
        scenario: {},
        targetLanguage: "es",
        titleSnapshot: "At the market",
        userId,
      },
    }),
    prisma.mistakePattern.create({
      data: {
        content: {},
        goalId: goal.id,
        kind: "pattern",
        language: "es",
        model: "test-model",
        promptVersion: "test",
        runId: `test-run-${contentId}`,
        title: "Ser and estar",
        userId,
      },
    }),
    prisma.mockExam.create({
      data: { conditions: {}, goalId: goal.id, sectionStartedAt: STUDY_DAY, userId },
    }),
    prisma.examResult.create({ data: { examName: "Test exam", goalId: goal.id, userId } }),
    prisma.evaluationRun.create({
      data: {
        answers: [],
        contentScope: "personal",
        goalId: goal.id,
        inputHash: contentId,
        latencyMs: 1000,
        model: "test-model",
        promptVersion: "test",
        requestedModel: "test-model",
        runId: `test-run-${contentId}`,
        task: "test-task",
        userId,
      },
    }),
    prisma.userProgress.update({ data: { totalBrainPower: brainPower }, where: { userId } }),
  ]);

  await prisma.userLearningProfile.create({
    data: { activeGoalId: goal.id, buddyKind: "zu", buddyName: "Zuzu", userId },
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
    prisma.aiCall.count(byUser),
    prisma.languageConversation.count(byUser),
    prisma.mistakePattern.count(byUser),
    prisma.mockExam.count(byUser),
    prisma.examResult.count(byUser),
    prisma.evaluationRun.count(byUser),
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
    aiCalls,
    conversations,
    patterns,
    mocks,
    examResults,
    evaluations,
  ] = counts;

  return {
    aiCalls,
    attempts,
    conversations,
    days,
    drafts,
    evaluations,
    events,
    examResults,
    feedback,
    goals,
    memory,
    milestones,
    mocks,
    patterns,
    skills,
    usage,
    votes,
  };
}
