import "server-only";
import { prisma } from "@zoonk/db";
import { readLearningProfile } from "../learner/facts/learning-profile";
import { getRequestInstant } from "../learner/facts/request-instant";
import { loadMemoryExport } from "../memory/_utils/memory-export";
import { findLearningProfileView } from "../profile/_utils/learning-profile-view";
import {
  loadBuddyExport,
  loadLanguageExport,
  loadStartExport,
  loadStudyExport,
  loadUsageExport,
} from "./_utils/account-export-sections";
import { getSession } from "./get-session";

const byCreation = [{ createdAt: "asc" as const }, { id: "asc" as const }];
const byAnswer = [{ answeredAt: "asc" as const }, { id: "asc" as const }];

function loadGoals(userId: string) {
  return prisma.goal.findMany({
    include: {
      plan: {
        include: { changes: { orderBy: byCreation }, items: { orderBy: { position: "asc" } } },
      },
    },
    orderBy: byCreation,
    where: { userId },
  });
}

/** Brain Power is stored as a big integer, which JSON can't hold; a learner's total fits a number. */
async function loadProgressTotals(userId: string) {
  const totals = await prisma.userProgress.findUnique({ where: { userId } });
  return totals ? { ...totals, totalBrainPower: Number(totals.totalBrainPower) } : null;
}

function loadProgress(userId: string) {
  return Promise.all([
    loadProgressTotals(userId),
    prisma.dailyProgress.findMany({ orderBy: { date: "asc" }, where: { userId } }),
    prisma.learningEvent.findMany({
      orderBy: [{ startedAt: "asc" }, { id: "asc" }],
      where: { userId },
    }),
  ]);
}

function loadLearnerModel(userId: string) {
  return Promise.all([
    prisma.learnerSkill.findMany({ orderBy: byCreation, where: { userId } }),
    prisma.mistake.findMany({ orderBy: byCreation, where: { userId } }),
    prisma.milestone.findMany({ orderBy: { earnedAt: "asc" }, where: { userId } }),
  ]);
}

/** Requires sign-in; uncached export reflects currently stored personal data. */
export async function exportCurrentUserData() {
  const session = await getSession();

  if (!session) {
    return null;
  }

  const userId = session.user.id;

  const [
    account,
    profile,
    goals,
    [progress, dailyProgress, learningEvents],
    attempts,
    [skills, mistakes, milestones],
    memory,
    feedbackMessages,
    buddy,
    study,
    language,
    start,
    usage,
  ] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      select: { createdAt: true, email: true, image: true, name: true, username: true },
      where: { id: userId },
    }),
    findLearningProfileView(userId, readLearningProfile(userId)),
    loadGoals(userId),
    loadProgress(userId),
    prisma.attempt.findMany({ orderBy: byAnswer, where: { userId } }),
    loadLearnerModel(userId),
    loadMemoryExport(userId),
    prisma.feedback.findMany({ omit: { status: true }, orderBy: byCreation, where: { userId } }),
    loadBuddyExport(userId),
    loadStudyExport(userId),
    loadLanguageExport(userId),
    loadStartExport(userId),
    loadUsageExport(userId),
  ]);

  return {
    account,
    answers: { attempts },
    buddy,
    exportedAt: await getRequestInstant(),
    feedback: { messages: feedbackMessages },
    goals,
    language,
    learnerModel: { milestones, mistakes, skills },
    memory,
    profile,
    progress: { daily: dailyProgress, learningEvents, totals: progress },
    start,
    study,
    usage,
  };
}

export type AccountDataExport = NonNullable<Awaited<ReturnType<typeof exportCurrentUserData>>>;
