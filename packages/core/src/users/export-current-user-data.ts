import "server-only";
import { prisma } from "@zoonk/db";
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

/** Goals with their plans, the plan's items and every change it went through. */
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

/** Totals, days and every learning session behind the stats pages. */
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

/** Votes and messages the learner sent about content and the app. */
function loadFeedback(userId: string) {
  return Promise.all([
    prisma.contentFeedback.findMany({
      omit: { model: true, promptVersion: true, runId: true },
      orderBy: byCreation,
      where: { userId },
    }),
    prisma.feedback.findMany({ omit: { status: true }, orderBy: byCreation, where: { userId } }),
  ]);
}

/** Guardian links as the learner sees them: the invite token stays in the guardian's email. */
function loadGuardianLinks(userId: string) {
  return prisma.guardianLink.findMany({
    omit: { tokenHash: true },
    orderBy: byCreation,
    where: { userId },
  });
}

/**
 * Everything Zoonk keeps about the signed-in learner, as one download: the account, the learning
 * profile, goals and plans, the progress ledger, study sessions and mocks, answers, skills,
 * mistakes, milestones, language learning, memory, the buddy's conversations and the example lines
 * written from memory, sources, usage, feedback and guardian links. Uncached, so it reflects what's
 * stored at that moment.
 */
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
    [contentVotes, feedbackMessages],
    guardianLinks,
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
    findLearningProfileView(userId),
    loadGoals(userId),
    loadProgress(userId),
    prisma.attempt.findMany({ orderBy: byAnswer, where: { userId } }),
    loadLearnerModel(userId),
    loadMemoryExport(userId),
    loadFeedback(userId),
    loadGuardianLinks(userId),
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
    exportedAt: new Date(),
    feedback: { contentVotes, messages: feedbackMessages },
    goals,
    guardianLinks,
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
